import assert from "node:assert/strict";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

function plan(command = { label: "retrieval", run: "printf retrieved" }) {
  return JSON.stringify({ commands: [command] });
}

async function run(world, input) {
  if (world.plan) {
    world.directory ??= await mkdtemp(join(tmpdir(), "yoink-command-"));
    await writeFile(join(world.directory, "plan.json"), world.plan);
  }
  const arguments_ = world.arguments ?? (world.argument === undefined ? ["plan.json"] : world.argument ? [world.argument] : []);
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
  world.result = { stdout, stderr, status };
}

Given("a plan file named {string} contains one retrieval command", async function (name) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-plan-"));
  this.argument = name;
  await writeFile(join(this.directory, name), plan());
});

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

Given("a root command collection has a failing piped producer and a successful consumer", async function () {
  this.pipefail = true;
  this.directory = await mkdtemp(join(tmpdir(), "yoink-pipefail-"));
  this.commands = [
    { label: "source", run: "printf producer; false", pipe: true },
    { label: "destination", run: "cat >/dev/null" },
  ];
  await writeFile(join(this.directory, "plan.json"), JSON.stringify({ commands: this.commands }));
});

Given("standard input contains a plan with one retrieval command", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-stdin-"));
  this.stdin = plan();
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
  await writeFile(join(this.directory, "plan.json"), JSON.stringify(values[invalidValue]));
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
  if (this.pipefail) assert.match(this.result.stdout.toString(), /label: destination/);
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
