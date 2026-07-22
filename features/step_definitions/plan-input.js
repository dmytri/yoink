import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";
import Ajv2020 from "ajv/dist/2020.js";

function plan(command = { label: "retrieval", run: "printf retrieved" }) {
  return JSON.stringify({ commands: [command] });
}

async function run(world, input) {
  if (world.plan) {
    world.directory ??= await mkdtemp(join(tmpdir(), "yoink-command-"));
    await writeFile(join(world.directory, "plan.json"), world.plan);
  }
  const arguments_ = world.arguments ?? (world.argument === undefined ? ["plan.json"] : world.argument ? [world.argument] : []);
  const startedAt = Date.now();
  const child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), ...arguments_], {
    cwd: world.directory,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end(input);
  const collect = (stream) => new Promise((resolve) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const [stdout, stderr, status] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise((resolve) => child.on("close", (code) => resolve(code))),
  ]);
  world.result = { stdout, stderr, status, elapsedMs: Date.now() - startedAt };
}

Given("a plan file named {string} contains a root command collection with one retrieval command", async function (name) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-plan-"));
  this.argument = name;
  await writeFile(join(this.directory, name), plan());
});

Given("the caller provides no plan argument", function () {
  this.directory = process.cwd();
  this.argument = "";
});

Given("a root command collection has a command that prints {string} and sets {string} to true", async function (output, field) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipe-"));
  this.argument = "plan.json";
  this.commands = [{ label: "source", run: `printf ${output}`, [field]: true }];
});

Given("the next command reads standard input", async function () {
  this.commands.push({
    label: "destination",
    run: this.streaming ? "cat > consumer-received" : "sed 's/^/received:/'",
  });
  await writeFile(join(this.directory, "plan.json"), JSON.stringify({ commands: this.commands }));
});

Given("a root command collection has a piped command that stays active after writing {string}", async function (output) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipe-"));
  this.streaming = true;
  this.commands = [{
    label: "source",
    run: `printf ${output}; sleep 0.5; touch producer-finished`,
    pipe: true,
  }];
});

Given("a producer emits output continuously", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-epipe-"));
  this.argument = "plan.json";
  this.producerTimeoutMs = 2_000;
  this.commands = [{ label: "producer", run: "yes", pipe: true, timeout: 2 }];
});

Given("a producer emits one line and remains active until its timeout", async function () {
  this.pipefail = true;
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipefail-timeout-"));
  this.commands = [{ label: "producer", run: "printf 'producer\\n'; sleep 2", pipe: true, timeout: 1 }];
});

Given("the consumer exits after reading one line", async function () {
  this.expectedConsumerLabel = "consumer";
  this.commands.push({ label: "consumer", run: "head -n 1 >/dev/null" });
  await writeFile(join(this.directory, "plan.json"), JSON.stringify({ commands: this.commands }));
});

Given("a root command collection has a failing piped producer and a successful consumer", async function () {
  this.pipefail = true;
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipefail-"));
  this.commands = [
    { label: "source", run: "printf producer; false", pipe: true },
    { label: "destination", run: "cat >/dev/null" },
  ];
  this.expectedConsumerLabel = "destination";
  await writeFile(join(this.directory, "plan.json"), JSON.stringify({ commands: this.commands }));
});

Given("standard input contains a root command collection with one retrieval command", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-stdin-"));
  this.stdin = plan();
});

Given("a plan file contains malformed JSON", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-invalid-"));
  this.argument = "plan.json";
  await writeFile(join(this.directory, "plan.json"), "{");
});

Given("a plan command has a cwd that points to a file", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-cwd-file-"));
  this.argument = "plan.json";
  const filePath = join(this.directory, "a-file");
  await writeFile(filePath, "file content");
  await writeFile(
    join(this.directory, "plan.json"),
    JSON.stringify({
      commands: [{ label: "retrieval", run: "printf retrieved", cwd: filePath }],
    }),
  );
});

Given("a valid retrieval plan", function () {
  this.validPlan = { commands: [{ label: "retrieval", run: "printf retrieved" }] };
});

When("the plan is checked against {string}", function (schemaPath) {
  const schema = JSON.parse(readFileSync(join(process.cwd(), schemaPath), "utf8"));
  const validate = new Ajv2020().compile(schema);
  this.planConforms = validate(this.validPlan);
  this.planValidationErrors = validate.errors;
});

Then("the plan conforms to the schema", function () {
  assert.equal(this.planConforms, true, JSON.stringify(this.planValidationErrors));
});

Given(/a plan whose (.+) is invalid/, async function (invalidValue) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-invalid-"));
  this.argument = "plan.json";
  const values = {
    "missing commands": {},
    "non-array commands": { commands: {} },
    "empty command label": { commands: [{ label: "", run: "printf executed" }] },
    "empty command run": { commands: [{ label: "retrieval", run: "" }] },
    "unknown top-level field": { commands: [], unexpected: true },
    "unknown command field": { commands: [{ label: "retrieval", run: "printf executed", extra: true }] },
    "command stdin": { commands: [{ label: "retrieval", run: "printf executed", stdin: "args" }] },
    "non-positive command timeout": { commands: [{ label: "retrieval", run: "printf executed", timeout: 0 }] },
    "non-directory command cwd": { commands: [{ label: "retrieval", run: "printf executed", cwd: "missing" }] },
    "non-boolean pipe": { commands: [{ label: "retrieval", run: "printf executed", pipe: "yes" }] },
    "non-boolean capture": { commands: [{ label: "retrieval", run: "printf executed", capture: "yes" }] },
    "non-string cwd": { commands: [{ label: "retrieval", run: "printf executed", cwd: 123 }] },
  };
  if (invalidValue === "non-finite parsed command timeout") {
    await writeFile(
      join(this.directory, "plan.json"),
      '{"commands":[{"label":"retrieval","run":"printf executed","timeout":1e309}]}',
    );
  } else {
    await writeFile(join(this.directory, "plan.json"), JSON.stringify(values[invalidValue]));
  }
});

When("the caller runs {string}", async function (argument) {
  this.argument = argument.replace("yoink ", "");
  await run(this, this.stdin);
});

When("the caller runs Yoink with the plan", async function () {
  await run(this, this.stdin);
});

When("the caller runs Yoink with {string}", async function (option) {
  this.arguments = [option, "plan.json"];
  await run(this, this.stdin);
});

When("the caller runs Yoink", async function () {
  await run(this, this.stdin);
});

Then("Yoink executes the retrieval command from {string}", function (_name) {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), /retrieved/);
});

Then("Yoink executes the retrieval command from standard input", function () {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), /retrieved/);
});

Then("Yoink prints usage and exits successfully", function () {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), /usage/i);
});

Then("the next command receives {string} on standard input", function (argument) {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), new RegExp(`received:${argument}`));
});

Then("the next command receives {string} before the piped command exits", async function (_output) {
  const consumer = await stat(join(this.directory, "consumer-received"));
  const producer = await stat(join(this.directory, "producer-finished"));
  assert.ok(consumer.mtimeMs < producer.mtimeMs);
});

Then("Yoink exits successfully", function () {
  assert.equal(this.result.status, 0);
});

Then("Yoink exits with a non-zero status", function () {
  assert.notEqual(this.result.status, 0);
  if (this.pipefail)
    assert.ok(this.result.stdout.toString().includes(`"label":"${this.expectedConsumerLabel}"`));
});

Then("Yoink exits with a non-zero status before executing a retrieval command", function () {
  assert.notEqual(this.result.status, 0);
  assert.doesNotMatch(this.result.stdout.toString(), /retrieved/);
});

Then("Yoink writes a validation diagnostic for {string} to standard error", function (path) {
  assert.match(this.result.stderr.toString(), new RegExp(path.replace(/[.[\]$]/g, "\\$&")));
});

Then("Yoink does not execute a retrieval command", function () {
  assert.doesNotMatch(this.result.stdout.toString(), /executed/);
});

Given("the caller provides {string}", async function (flag) {
  this.arguments = flag.split(" ");
  this.directory = process.cwd();
  if (this.arguments[0] === "--max-bytes" && this.arguments.length > 1) {
    this.directory = await mkdtemp(join(tmpdir(), "yoink-max-bytes-"));
    return writeFile(join(this.directory, "plan.json"), plan());
  }
});

Then("Yoink prints the usage text from {string}", function (asset) {
  assert.equal(this.result.stdout.toString(), readFileSync(join(process.cwd(), asset), "utf8"));
});

Then("Yoink prints the package version and exits successfully", function () {
  assert.equal(this.result.status, 0);
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  assert.match(this.result.stdout.toString(), new RegExp(pkg.version));
});

Given("a plan file is missing", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-missing-"));
  this.argument = "no-such-file.json";
});

Given("the caller provides an extra argument", function () {
  this.arguments = ["plan.json", "extra-arg"];
});

Then("Yoink prints a diagnostic for the extra argument to standard error", function () {
  assert.match(this.result.stderr.toString(), /extra|unexpected|argument/i);
});

Then("Yoink prints a compact diagnostic for the missing file to standard error", function () {
  assert.match(this.result.stderr.toString(), /no such file|not found|enoent/i);
});

Then("Yoink prints a compact diagnostic for invalid JSON to standard error", function () {
  assert.match(this.result.stderr.toString(), /JSON|unexpected token|invalid|parse/i);
});

Then("the diagnostic is a single line", function () {
  const diagnostic = this.result.stderr.toString().trim();
  assert.notEqual(diagnostic.length, 0);
  assert.equal(diagnostic.split("\n").length, 1);
});

Then("Yoink prints a diagnostic for the unknown option to standard error", function () {
  assert.match(this.result.stderr.toString(), /unknown option|unrecognized|invalid option/i);
});

Then("Yoink prints a diagnostic for the missing flag value to standard error", function () {
  assert.match(this.result.stderr.toString(), /missing.*value|requires a value|--max-bytes.*need|flag.*value/i);
});

Then("Yoink prints a diagnostic for the invalid flag value to standard error", function () {
  assert.match(this.result.stderr.toString(), /invalid.*value|--max-bytes.*invalid|must be|positive/i);
});

Then("Yoink does not crash with EPIPE", function () {
  assert.doesNotMatch(this.result.stderr.toString(), /EPIPE/);
});

Then("the pipeline finishes before the producer timeout", function () {
  assert.equal(this.result.status, 0);
  assert.ok(this.result.elapsedMs < this.producerTimeoutMs);
  assert.ok(this.result.elapsedMs < 1_000, `pipeline took ${this.result.elapsedMs}ms`);
});

Then("the producer result records an intentional pipe-close status", function () {
  const metadata = [...this.result.stdout.toString().matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{.*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const producer = metadata.find((entry) => entry.label === "producer");
  assert.ok(producer);
  assert.equal(producer.timedOut, false);
  assert.ok(producer.pipeClosed === true || producer.signal === "SIGPIPE");
});

Then("the producer result records both an intentional pipe-close status and a timeout", function () {
  const metadata = [...this.result.stdout.toString().matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{.*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const producer = metadata.find((entry) => entry.label === "producer");
  assert.ok(producer);
  assert.equal(producer.timedOut, true);
  assert.equal(producer.pipeClosed, true);
});
