import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

function setPlan(world, command) {
  world.plan = JSON.stringify({ commands: Array.isArray(command) ? command : [command] });
}

function bundle(world) {
  return world.bundle ?? world.result.stdout;
}

function metadata(world) {
  const output = bundle(world).toString();
  const b = boundary(world);
  const results = [];
  let pos = 0;
  while (true) {
    const start = output.indexOf(`name="metadata"\r\n\r\n`, pos);
    if (start === -1) break;
    const jsonStart = start + `name="metadata"\r\n\r\n`.length;
    const jsonEnd = output.indexOf(`\r\n--${b}`, jsonStart);
    results.push(JSON.parse(output.slice(jsonStart, jsonEnd === -1 ? undefined : jsonEnd)));
    pos = jsonEnd === -1 ? output.length : jsonEnd;
  }
  return results;
}

function boundary(world) {
  const m = bundle(world).toString().match(/^Content-Type: multipart\/mixed; boundary=(.+)$/m);
  return m?.[1];
}

function stdoutBodies(world) {
  const output = bundle(world).toString();
  const b = boundary(world);
  const results = [];
  let pos = 0;
  while (true) {
    const start = output.indexOf(`name="stdout"\r\n\r\n`, pos);
    if (start === -1) break;
    const bodyStart = start + `name="stdout"\r\n\r\n`.length;
    const bodyEnd = output.indexOf(`\r\n--${b}`, bodyStart);
    results.push(output.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd));
    pos = bodyEnd === -1 ? output.length : bodyEnd;
  }
  return results;
}

async function run(world, outputFile) {
  world.directory ??= await mkdtemp(join(tmpdir(), "yoink-multipart-"));
  await writeFile(join(world.directory, "plan.json"), world.plan);
  const output = outputFile ? await import("node:fs/promises").then(({ open }) => open(join(world.directory, outputFile), "w")) : null;
  const child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), "plan.json"], {
    cwd: world.directory,
    stdio: ["ignore", output ? output.fd : "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout?.on("data", (chunk) => chunks.push(chunk));
  await new Promise((resolve) => child.on("close", resolve));
  await output?.close();
  world.bundle = outputFile ? await readFile(join(world.directory, outputFile)) : Buffer.concat(chunks);
}

Given("a plan command has a label, command, and working directory", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-metadata-"));
  setPlan(this, { label: "metadata", run: "printf payload", cwd: this.directory });
});

Given("a plan has one successful command", function () {
  setPlan(this, { label: "success", run: "printf payload" });
});

Given("a plan has a piped producer that emits {string} and a successful consumer", function (output) {
  setPlan(this, [
    { label: "source", run: `printf ${output}`, pipe: true },
    { label: "destination", run: "cat" },
  ]);
});

Given("a plan has a piped producer that emits {string}, sets {string} to true, and a successful consumer", function (output, field) {
  setPlan(this, [
    { label: "source", run: `printf ${output}`, pipe: true, [field]: true },
    { label: "destination", run: "cat" },
  ]);
});

Given("a plan command emits Markdown with nested fenced JSON and Bash blocks", function () {
  this.stdout = Buffer.from("# title\n```json\n{\"a\":1}\n```\n```bash\nprintf hi\n```\n");
  setPlan(this, { label: "markdown", run: `printf '${this.stdout.toString().replace(/'/g, "'\\''")}'` });
});

Given("the command emits a JSON result on standard error", function () {
  this.stderr = Buffer.from('{"error":true}');
  const command = JSON.parse(this.plan).commands[0];
  command.run += `; printf '${this.stderr}' >&2`;
  setPlan(this, command);
});

Given("a plan command emits a {string} label, emoji, and ANSI colour bytes", function (label) {
  this.stdout = Buffer.from("emoji: 😀 \u001b[31mred\u001b[0m", "utf8");
  setPlan(this, { label, run: "printf 'emoji: 😀 \\033[31mred\\033[0m'" });
});

Given("a captured command stream contains a candidate multipart boundary", function () {
  this.stdout = Buffer.from("--candidate-boundary--");
  setPlan(this, { label: "collision", run: "printf -- '--candidate-boundary--'" });
});

When("the caller redirects Yoink standard output to {string}", async function (file) {
  await run(this, file);
  this.outputFile = file;
});

Then("each emitted result names its label and exact command", function () {
  const command = JSON.parse(this.plan).commands[0];
  const meta = metadata(this)[0];
  assert.equal(meta.label, command.label);
  assert.equal(meta.command, command.run);
});

Then("each emitted result names its working directory, exit code, duration, and timeout status", function () {
  const meta = metadata(this)[0];
  assert.ok(meta.cwd);
  assert.equal(meta.exitCode, 0);
  assert.ok(typeof meta.durationMs === "number");
  assert.equal(meta.timedOut, false);
});

Then("the bundle declares one random boundary", function () {
  assert.ok(boundary(this));
});

Then("every multipart delimiter uses the declared boundary", function () {
  const lines = bundle(this).toString().split(/\r\n/);
  for (const line of lines) {
    const m = line.match(/^--(.+?)(?:--)?$/);
    if (m) assert.equal(m[1], boundary(this));
  }
});

Then("the closing delimiter ends with two hyphens", function () {
  assert.match(bundle(this).toString(), new RegExp(`--${boundary(this)}--\\r\\n?$`));
});

Then("each multipart stream body equals its emitted bytes", function () {
  assert.ok(bundle(this).includes(this.stdout));
  if (this.stderr) assert.ok(bundle(this).includes(this.stderr));
});

Then("the declared boundary does not occur in result metadata or captured output other than preserved stream bodies", function () {
	const output = bundle(this);
	const b = boundary(this);
	assert.ok(b);
	const metadata = output.subarray(
		output.indexOf(Buffer.from('name="metadata"\r\n\r\n')),
		output.indexOf(Buffer.from(`\r\n--${b}\r\nContent-Type: application/octet-stream`)),
	);
	assert.doesNotMatch(metadata.toString(), new RegExp(b));
});

Then("the bundle preserves the captured command stream bytes", function () {
  assert.ok(bundle(this).includes(this.stdout));
});

Then("the bundle omits the piped producer's stdout", function () {
  assert.equal(stdoutBodies(this)[0], "");
});

Then("the bundle includes the consumer's stdout", function () {
  assert.equal(stdoutBodies(this)[1], "upstream");
});

Then("the bundle includes the piped producer's stdout", function () {
  assert.equal(stdoutBodies(this)[0], "upstream");
});

Then("{string} equals the bundle Yoink writes to standard output", async function (file) {
  assert.deepEqual(await readFile(join(this.directory, file)), this.bundle);
});
