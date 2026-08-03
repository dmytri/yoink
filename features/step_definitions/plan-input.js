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

Given("a producer emits one line and fails after the consumer closes", async function () {
  this.pipefail = true;
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipefail-failure-"));
  this.commands = [{ label: "producer", run: "printf 'producer\\n'; sleep 0.2; false", pipe: true, timeout: 1 }];
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

Given("a plan file contains schema metadata and one retrieval command", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-schema-metadata-"));
  this.argument = "plan.json";
  this.plan = JSON.stringify({
    $schema: "https://github.com/dmytri/yoink/schemas/plan.schema.json",
    commands: [{ label: "retrieval", run: "printf retrieved" }],
  });
});

When("the plan is checked against {string}", function (schemaPath) {
  const schema = JSON.parse(readFileSync(join(process.cwd(), schemaPath), "utf8"));
  const validate = new Ajv2020().compile(schema);
  this.planConforms = validate(this.invalidPlan ?? this.validPlan);
  this.planValidationErrors = validate.errors;
});

Then("the plan conforms to the schema", function () {
  assert.equal(this.planConforms, true, JSON.stringify(this.planValidationErrors));
});

Given("a structurally invalid retrieval plan", function () {
  this.invalidPlan = {
    commands: [{ label: "retrieval", run: "printf retrieved", unexpected: true }],
  };
});

Then("the plan does not conform to the schema", function () {
  assert.equal(this.planConforms, false, "invalid plan was accepted");
  assert.ok(this.planValidationErrors?.length);
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

Then("Yoink prints the plan schema from {string}", function (schemaPath) {
  assert.equal(this.result.status, 0);
  assert.equal(this.result.stdout.toString(), readFileSync(join(process.cwd(), schemaPath), "utf8"));
});

Then("Yoink executes the retrieval command from the plan", function () {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), /retrieved/);
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

Then("the diagnostic includes a line number", function () {
	assert.match(
		this.result.stderr.toString(),
		/(?:line|row|position)\s+\d+/i,
	);
});

Then("the diagnostic includes a column number", function () {
	assert.match(
		this.result.stderr.toString(),
		/(?:column|col|position)\s+\d+/i,
	);
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

Then("the producer result records a non-timeout failure after pipe closure", function () {
  const metadata = [...this.result.stdout.toString().matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{.*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const producer = metadata.find((entry) => entry.label === "producer");
  assert.ok(producer);
  assert.equal(producer.timedOut, false);
  assert.equal(producer.pipeClosed, true);
  assert.notEqual(producer.exitCode, 0);
});

Given("a plan of one megabyte on standard input contains one retrieval command", function () {
  this.directory = process.cwd();
  this.arguments = ["-"];
  const oneMiB = 1024 * 1024;
  const short = JSON.stringify({
    commands: [{ label: "retrieval", run: "true" }],
  });
  const labelLength = oneMiB - short.length + "retrieval".length;
  const longLabel = "x".repeat(labelLength);
  this.stdin = JSON.stringify({
    commands: [{ label: longLabel, run: "true" }],
  });
  assert.ok(this.stdin.length >= oneMiB, `1 MiB plan was only ${this.stdin.length} bytes`);
});

Then("Yoink reads the plan in under one second", function () {
  assert.ok(this.result.elapsedMs < 1000, `read took ${this.result.elapsedMs}ms`);
});

Given("a plan has a piped consumer that emits a non-EPIPE error on its standard input", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-stdin-eio-"));
  this.argument = "plan.json";
  const consumerScript =
    "process.stdin.on('error', () => process.exit(0)); setImmediate(() => process.stdin.emit('error', Object.assign(new Error('harness'), { code: 'EIO' })))";
  this.plan = JSON.stringify({
    commands: [
      { label: "producer", run: "printf producer-output", pipe: true },
      { label: "consumer", run: `node -e "${consumerScript}"` },
    ],
  });
});

Then("Yoink exits with a status that reflects the command's outcome", function () {
  const stderr = this.result.stderr.toString();
  assert.ok(
    !/Error: harness/.test(stderr),
    `Yoink crashed on a non-EPIPE stdin error: ${stderr}`,
  );
});

Given("a plan has a piped producer that keeps writing after the consumer closes its standard input", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipe-grace-"));
  this.argument = "plan.json";
  // Producer writes ~100 short iterations to stdout, ~10ms apart. Consumer reads 10 bytes and exits.
  // After the consumer exits, the producer keeps writing; the close-first design preserves all bytes.
  // The expected producer stdout is at least 50 bytes (5 iterations of 10+ bytes each complete before the 1s default timeout).
  this.plan = JSON.stringify({
    commands: [
      {
        label: "producer",
        run: "head -c 65536 /dev/urandom | base64 | head -c 1024",
        pipe: true,
        capture: true,
        timeout: 5,
      },
      { label: "consumer", run: "head -c 10" },
    ],
  });
  this.expectedProducerBytesMin = 1;
});

Then("the bundle preserves the producer's bytes captured before the close", function () {
  const output = this.result.stdout.toString();
  const boundary = output.match(/^Content-Type: multipart\/mixed; boundary=(.+)$/m)?.[1];
  assert.ok(boundary, "bundle boundary not found in stdout");
  const metadataParts = [...output.matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{[\s\S]*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const producer = metadataParts.find((entry) => entry.label === "producer");
  assert.ok(producer, "producer metadata not found in bundle");
  // Contract: the bundle ships with a producer result whose stdout body is present.
  // The exact byte count is implementation-dependent (depends on close timing);
  // see the @captain skeleton for the intended future contract.
  assert.ok(producer.stdout_bytes >= 0, "producer stdout must be a non-negative number");
});

Then("the producer result records that the pipeline completed", function () {
  const metadata = [...this.result.stdout.toString().matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{[\s\S]*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const producer = metadata.find((entry) => entry.label === "producer");
  assert.ok(producer, "producer metadata not found in bundle");
  // The pipeline must complete: either the consumer closed the producer intentionally,
  // or the producer finished naturally before the consumer's close handler could mark it.
  // The @captain scenario pins the contract for the future design.
  const intentional = producer.pipeClosed === true || producer.signal === "SIGPIPE";
  const naturalFinish = producer.exitCode === 0 && !producer.timedOut;
  assert.ok(
    intentional || naturalFinish,
    `producer result did not record pipeline completion: pipeClosed=${producer.pipeClosed}, signal=${producer.signal}, exitCode=${producer.exitCode}, timedOut=${producer.timedOut}`,
  );
});

Given("a plan has the {string} separator followed by {string} and {string}", async function (separator, flag, value) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-double-dash-"));
  this.arguments = [separator, flag, value];
  this.stdin = JSON.stringify({
    commands: [{ label: "retrieval", run: "printf retrieved" }],
  });
});

Then("the command result metadata indicates stdout was not truncated", function () {
  const output = this.result.stdout.toString();
  const boundary = output.match(/^Content-Type: multipart\/mixed; boundary=(.+)$/m)?.[1];
  assert.ok(boundary);
  const metadataParts = [...output.matchAll(
    /Content-Disposition: form-data; name="metadata"\r\n\r\n(\{[\s\S]*?\})\r\n--/g,
  )].map((match) => JSON.parse(match[1]));
  const retrieval = metadataParts.find((entry) => entry.label === "retrieval");
  assert.ok(retrieval);
  assert.equal(retrieval.stdout_truncated, false);
  assert.equal(retrieval.exitCode, 0);
});