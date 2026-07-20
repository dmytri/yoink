import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
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
  const arguments_ = world.argument === undefined ? ["plan.json"] : world.argument ? [world.argument] : [];
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

Given("the next command sets {string} to {string}", async function (field, value) {
  this.commands.push({ label: "destination", run: "printf 'received:%s' \"$@\"", [field]: value });
  await writeFile(join(this.directory, "plan.json"), JSON.stringify({ commands: this.commands }));
});

Given("standard input contains a plan with one retrieval command", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-stdin-"));
  this.stdin = plan();
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
    "non-positive command timeout": { commands: [{ label: "retrieval", run: "printf executed", timeout: 0 }] },
    "non-directory command cwd": { commands: [{ label: "retrieval", run: "printf executed", cwd: "missing" }] },
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

Then("the next command receives {string} as an argument", function (argument) {
  assert.equal(this.result.status, 0);
  assert.match(this.result.stdout.toString(), new RegExp(`received:${argument}`));
});

Then("Yoink exits with a non-zero status", function () {
  assert.notEqual(this.result.status, 0);
});

Then("Yoink writes a validation diagnostic for {string} to standard error", function (path) {
  assert.match(this.result.stderr.toString(), new RegExp(path.replace(/[.[\]$]/g, "\\$&")));
});

Then("Yoink does not execute a retrieval command", function () {
  assert.doesNotMatch(this.result.stdout.toString(), /executed/);
});
