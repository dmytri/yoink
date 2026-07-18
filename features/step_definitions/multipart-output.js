import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

function setPlan(world, command) {
  world.plan = JSON.stringify({ commands: [command] });
}

function bundle(world) {
  return world.bundle ?? world.result.stdout;
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
  assert.match(bundle(this).toString(), new RegExp(`label: ${command.label}`));
  assert.match(bundle(this).toString(), new RegExp(`command: ${command.run}`));
});

Then("each emitted result names its working directory, exit code, duration, and timeout status", function () {
  assert.match(bundle(this).toString(), /working directory: /);
  assert.match(bundle(this).toString(), /exit code: 0/);
  assert.match(bundle(this).toString(), /duration: /);
  assert.match(bundle(this).toString(), /timeout: no/);
});

Then("the bundle declares one random boundary", function () {
  const match = bundle(this).toString().match(/^Content-Type: multipart\/mixed; boundary=(.+)$/m);
  assert.ok(match);
  this.boundary = match[1];
});

Then("every multipart delimiter uses the declared boundary", function () {
  assert.ok([...bundle(this).toString().matchAll(/^--(.+?)(?:--)?$/gm)].every((match) => match[1] === this.boundary));
});

Then("the closing delimiter ends with two hyphens", function () {
  assert.match(bundle(this).toString(), new RegExp(`--${this.boundary}--\\n?$`));
});

Then("each multipart stream body equals its emitted bytes", function () {
  assert.ok(bundle(this).includes(this.stdout));
  if (this.stderr) assert.ok(bundle(this).includes(this.stderr));
});

Then("the declared boundary does not occur in result metadata or captured output other than preserved stream bodies", function () {
	const output = bundle(this);
	const boundary = output.toString().match(/^Content-Type: multipart\/mixed; boundary=(.+)$/m)?.[1];
	assert.ok(boundary);
	const metadata = output.subarray(
		output.indexOf(Buffer.from('name="metadata"\n\n')),
		output.indexOf(Buffer.from(`\n--${boundary}\nContent-Type: application/octet-stream`)),
	);
	assert.doesNotMatch(metadata.toString(), new RegExp(boundary));
});

Then("the bundle preserves the captured command stream bytes", function () {
  assert.ok(bundle(this).includes(this.stdout));
});

Then("{string} equals the bundle Yoink writes to standard output", async function (file) {
  assert.deepEqual(await readFile(join(this.directory, file)), this.bundle);
});
