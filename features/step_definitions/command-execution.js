import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then, setDefaultTimeout } from "@cucumber/cucumber";

setDefaultTimeout(5000);

function setPlan(world, commands) {
  world.plan = JSON.stringify({ commands });
}

async function run(world) {
  world.directory ??= await mkdtemp(join(tmpdir(), "yoink-command-"));
  await writeFile(join(world.directory, "plan.json"), world.plan);
  const child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), "plan.json"], {
    cwd: world.directory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (stream) => new Promise((resolve) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const [stdout, stderr, status] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal }))),
  ]);
  world.result = { stdout, stderr, ...status };
}

Given("a plan has commands that append {string} and then {string} to one file", function (first, second) {
  this.outputFile = "ordered.txt";
  setPlan(this, [
    { label: "first", run: `printf ${first} >> ${this.outputFile}` },
    { label: "second", run: `printf ${second} >> ${this.outputFile}` },
  ]);
});

Given("a plan command has a cwd relative to Yoink's starting directory", async function () {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-cwd-"));
  await mkdir(join(this.directory, "nested"));
  this.expectedDirectory = join(this.directory, "nested");
  setPlan(this, [{ label: "cwd", run: "pwd", cwd: "nested" }]);
});

Given("a plan command runs longer than one second without a timeout value", function () {
  setPlan(this, [{ label: "slow", run: "sleep 1.2" }]);
});

Given("a plan command runs longer than one second with a timeout of two seconds", function () {
  setPlan(this, [{ label: "slow", run: "sleep 1.2", timeout: 2 }]);
});

Given("a plan has a failing command followed by a successful command", function () {
  setPlan(this, [
    { label: "failure", run: "false" },
    { label: "success", run: "printf later" },
  ]);
});

Given("a plan command writes distinct text to standard output and standard error", function () {
  setPlan(this, [{ label: "streams", run: "printf standard-output; printf standard-error >&2" }]);
});

Given("a plan command has an active child process", function () {
  setPlan(this, [{ label: "child", run: "sleep 2" }]);
});

When("the command prints its working directory", async function () {
  await run(this);
});

function waitForChildReadiness(world) {
  const pidFile = world.pidFile ? join(world.directory, world.pidFile) : null;
  if (!pidFile) return;
  const deadline = Date.now() + 1000;
  return (async () => {
    while (Date.now() < deadline) {
      try {
        if ((await stat(pidFile)).size > 0) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  })();
}

When("Yoink receives a termination signal", async function () {
  this.directory ??= await mkdtemp(join(tmpdir(), "yoink-signal-"));
  await writeFile(join(this.directory, "plan.json"), this.plan);
  this.child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), "plan.json"], { cwd: this.directory, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (stream) => new Promise((resolve) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const stdoutPromise = collect(this.child.stdout);
  const stderrPromise = collect(this.child.stderr);
  const closed = new Promise((resolve) => this.child.on("close", (code, signal) => resolve({ code, signal })));
  await waitForChildReadiness(this);
  this.signalledAt = Date.now();
  this.child.kill("SIGTERM");
  const status = await closed;
  this.signal = status.signal;
  this.signalElapsed = Date.now() - this.signalledAt;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  this.result = { stdout, stderr, ...status };
});

Then("the file contains {string} before {string}", async function (first, second) {
  assert.equal(await readFile(join(this.directory, this.outputFile), "utf8"), `${first}${second}`);
});

Then("the command result names the resolved working directory", function () {
  assert.match(this.result.stdout.toString(), new RegExp(this.expectedDirectory));
});

Then("the command result is marked timed out", function () {
  assert.match(this.result.stdout.toString(), /"timedOut":true/);
});

Then("the command result is not marked timed out", function () {
  assert.doesNotMatch(this.result.stdout.toString(), /timed out/);
});

Then("the bundle contains results for both commands", function () {
  assert.match(this.result.stdout.toString(), /failure/);
  assert.match(this.result.stdout.toString(), /success/);
});

Then("the bundle has one stdout part with the standard output text", function () {
  assert.match(this.result.stdout.toString(), /standard-output/);
});

Then("the bundle has one stderr part with the standard error text", function () {
  assert.match(this.result.stdout.toString(), /standard-error/);
});

Then("Yoink terminates the active child process group", function () {
  assert.ok(this.signal === "SIGTERM" || this.signal === "SIGINT");
  assert.ok(this.signalElapsed < 1000);
});

Then("Yoink exits with the signal-derived status", function () {
  assert.ok(this.signal === "SIGTERM" || this.signal === "SIGINT");
});

Given("a plan command ignores SIGTERM without a timeout value", function () {
  this.pidFile = "pids.txt";
  setPlan(this, [{ label: "ignores-sigterm", run: `printf '%s\\n' $$ >> ${this.pidFile}; trap '' 15; sleep 3` }]);
});

Given("a plan has a three-command pipeline", function () {
  setPlan(this, [
    { label: "first", run: "printf first; sleep 2", pipe: true },
    { label: "second", run: "sed 's/^/received:/'", pipe: true },
    { label: "third", run: "cat" },
  ]);
});

Then("every pipeline member exits", async function () {
  assert.ok(this.signalElapsed < 5000);
  assert.equal(this.signal, "SIGTERM");
});

Given("a plan command exceeds {string}", function (_flag) {
  setPlan(this, [{ label: "verbose", run: "printf 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'" }]);
});

When("the caller runs Yoink with {string} and the plan", async function (args) {
  this.directory ??= await mkdtemp(join(tmpdir(), "yoink-command-"));
  await writeFile(join(this.directory, "plan.json"), this.plan);
  const parts = args.split(" ");
  const child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), ...parts, "plan.json"], {
    cwd: this.directory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const collect = (stream) => new Promise((resolve) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const [stdout, stderr, status] = await Promise.all([
    collect(child.stdout),
    collect(child.stderr),
    new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal }))),
  ]);
  this.result = { stdout, stderr, ...status };
});

Then("the command result indicates stdout was truncated", function () {
  assert.match(this.result.stdout.toString(), /truncated/);
});

Then("the command result metadata signal is {string}", function (expected) {
  assert.match(this.result.stdout.toString(), new RegExp(`"signal":"${expected}"`));
});

Given("a plan has a three-command pipeline that records PIDs", function () {
  this.pidFile = "pids.txt";
  setPlan(this, [
    { label: "first", run: `printf '%s\\n' $$ >> ${this.pidFile}; printf first; sleep 2`, pipe: true },
    { label: "second", run: `printf '%s\\n' $$ >> ${this.pidFile}; sed 's/^/received:/'`, pipe: true },
    { label: "third", run: `printf '%s\\n' $$ >> ${this.pidFile}; cat` },
  ]);
});

Then("no pipeline member PID remains running after Yoink exits", async function () {
  const contents = await readFile(join(this.directory, this.pidFile), "utf8");
  const pids = contents.trim().split("\n").filter(Boolean);
  for (const pid of pids) {
    const n = parseInt(pid, 10);
    if (Number.isNaN(n) || n > 999999) continue;
    try {
      process.kill(n, 0);
      assert.fail(`PID ${pid} is still running`);
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  }
});

Then("the command result metadata indicates stdout was truncated", function () {
  assert.match(this.result.stdout.toString(), /"stdout_truncated":true/);
});

Then("the stdout body is exactly {int} bytes", function (expected) {
	const output = this.result.stdout.toString();
	const b = output.match(/boundary=(.+)/)?.[1];
	const m = output.match(new RegExp(`name="stdout"\\r\\n\\r\\n(.+?)\\r\\n--${b}`, "s"));
	assert.equal(m?.[1]?.length, expected);
});

Given("a plan command writes large output to standard error", function () {
	setPlan(this, [{ label: "verbose", run: "printf 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' >&2" }]);
});

Then("the command result metadata indicates stderr was truncated", function () {
	assert.match(this.result.stdout.toString(), /"stderr_truncated":true/);
});

Then("the stderr body is exactly {int} bytes", function (expected) {
	const output = this.result.stdout.toString();
	const b = output.match(/boundary=(.+)/)?.[1];
	const m = output.match(new RegExp(`name="stderr"\\r\\n\\r\\n(.+?)\\r\\n--${b}`, "s"));
	assert.equal(m?.[1]?.length, expected);
});

Then("no child process remains running after Yoink exits", async function () {
  const contents = await readFile(join(this.directory, this.pidFile), "utf8");
  const pids = contents.trim().split("\n").filter(Boolean);
  for (const pid of pids) {
    const n = parseInt(pid, 10);
    if (Number.isNaN(n) || n > 999999) continue;
    try {
      process.kill(n, 0);
      assert.fail(`PID ${pid} is still running`);
    } catch (e) {
      if (e.code !== "ESRCH") throw e;
    }
  }
});

When("Yoink receives SIGINT", async function () {
  this.directory ??= await mkdtemp(join(tmpdir(), "yoink-signal-"));
  await writeFile(join(this.directory, "plan.json"), this.plan);
  this.child = spawn(process.execPath, [join(process.cwd(), "dist/cli.js"), "plan.json"], { cwd: this.directory, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (stream) => new Promise((resolve) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
  const stdoutPromise = collect(this.child.stdout);
  const stderrPromise = collect(this.child.stderr);
  const closed = new Promise((resolve) => this.child.on("close", (code, signal) => resolve({ code, signal })));
  await waitForChildReadiness(this);
  this.signalledAt = Date.now();
  this.child.kill("SIGINT");
  const status = await closed;
  this.signal = status.signal;
  this.signalElapsed = Date.now() - this.signalledAt;
  const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
  this.result = { stdout, stderr, ...status };
});
