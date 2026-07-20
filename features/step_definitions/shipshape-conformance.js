import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return files.flat();
}

Given("the voyage has no watchbill", async function () {
  this.voyageDirectory = await mkdtemp(join(tmpdir(), "yoink-voyage-"));
});

When("the watchbill conformance check runs", async function () {
  this.voyageFiles = await readdir(this.voyageDirectory);
});

Then("it accepts the deck", function () {
  assert.equal(this.voyageFiles.includes("watchbill.json"), false);
});

Given("Yoink production code has no active perturbation", function () {
  this.implementationDirectory = join(process.cwd(), "src");
});

When("the perturbation quiescence check runs", async function () {
  this.perturbationSources = await Promise.all(
    (await sourceFiles(this.implementationDirectory)).map((path) => readFile(path)),
  );
});

Then("it reports no PERTURBATION token", function () {
  for (const source of this.perturbationSources)
    assert.equal(source.includes("PERTURBATION"), false);
});

Given("Yoink starts a command that remains active", async function () {
  this.signalDirectory = await mkdtemp(join(tmpdir(), "yoink-signal-"));
  await writeFile(
    join(this.signalDirectory, "plan.json"),
    JSON.stringify({ commands: [{ label: "active", run: "sleep 2" }] }),
  );
  this.signalChild = spawn(
    process.execPath,
    [join(process.cwd(), "dist/cli.js"), "plan.json"],
    { cwd: this.signalDirectory },
  );
});

When("signal verification waits for child-process readiness", async function () {
  const children = `/proc/${this.signalChild.pid}/task/${this.signalChild.pid}/children`;
  const deadline = Date.now() + 1000;
  while (Date.now() < deadline) {
    const activeChildren = await readFile(children, "utf8");
    if (activeChildren.trim()) {
      this.observedChild = activeChildren.trim();
      this.signalChild.kill("SIGTERM");
      this.signal = await new Promise((resolve) =>
        this.signalChild.on("close", (_code, signal) => resolve(signal)),
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Yoink child process did not become observable");
});

Then("it sends SIGTERM only after the child process is observable", function () {
  assert.match(this.observedChild, /\d+/);
  assert.equal(this.signal, "SIGTERM");
});
