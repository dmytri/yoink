import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { Given, When, Then } from "@cucumber/cucumber";
import { scenarioEvidenceDirectory, writeScenarioEvidence } from "./agent-retrieval-skill.js";

const execFileAsync = promisify(execFile);

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

async function startsAnActiveCommand() {
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
}

async function waitsForChildProcessReadiness() {
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
}

function assertsChildProcessWasObservable() {
  assert.match(this.observedChild, /\d+/);
  assert.equal(this.signal, "SIGTERM");
}

Given("Yoink starts a command that remains active", startsAnActiveCommand);
When("signal verification waits for child-process readiness", waitsForChildProcessReadiness);
Then("it sends SIGTERM only after the child process is observable", assertsChildProcessWasObservable);

When("Yoink's signal test waits for child-process readiness", async function () {
  await startsAnActiveCommand.call(this);
  await waitsForChildProcessReadiness.call(this);
});

Given("the production seams carry plank annotations", function () {
  this.plankScanDirectory = join(process.cwd(), "src");
});

When("the plank-form check runs", { timeout: 30000 }, async function () {
  const { stdout } = await execFileAsync(
    "npx",
    ["cucumber-js", "--dry-run", "--format", "usage-json", "--tags", "not @captain and not @shipwright"],
    { cwd: process.cwd(), maxBuffer: 16 * 1024 * 1024 },
  );
  this.stepPatterns = JSON.parse(stdout).map((usage) => usage.pattern);
  this.skeletonScenarios = [];
  const specsDirectory = join(process.cwd(), "features");
  const featureFiles = (await readdir(specsDirectory)).filter((name) => name.endsWith(".feature"));
  for (const file of featureFiles) {
    const lines = (await readFile(join(specsDirectory, file), "utf8")).split("\n");
    let pendingTags = [];
    for (const line of lines) {
      if (/^\s*@/.test(line)) {
        pendingTags.push(...line.trim().split(/\s+/));
        continue;
      }
      const scenario = line.match(/^\s*Scenario(?: Outline)?:\s*(.+?)\s*$/);
      if (scenario) {
        if (pendingTags.includes("@captain")) this.skeletonScenarios.push(`features/${file}:${scenario[1]}`);
        pendingTags = [];
        continue;
      }
      if (line.trim() !== "") pendingTags = [];
    }
  }
  this.plankFindings = [];
  for (const path of await sourceFiles(this.plankScanDirectory)) {
    const text = await readFile(path, "utf8");
    const token = /@planks(-provisional)?\("((?:[^"\\]|\\.)*)"\)/g;
    let match;
    while ((match = token.exec(text)) !== null) {
      const docblock = text.lastIndexOf("/**", match.index) > text.lastIndexOf("*/", match.index);
      const after = docblock ? text.slice(text.indexOf("*/", match.index) + 2).replace(/^\s+/, "") : "";
      const declaration =
        docblock &&
        /^(export\s+default\s+|export\s+)?(async\s+)?(function\*?\s|class\s|const\s|let\s|var\s)/.test(after);
      this.plankFindings.push({
        path,
        provisional: Boolean(match[1]),
        value: JSON.parse(`"${match[2]}"`),
        docblock,
        declaration,
      });
    }
  }
});

Then("every plank token resolves to a docblock tag on a seam declaration", function () {
  assert.ok(this.plankFindings.length > 0, "no plank annotations found");
  for (const finding of this.plankFindings) {
    assert.ok(finding.docblock, `${finding.path}: plank token outside a docblock`);
    assert.ok(finding.declaration, `${finding.path}: plank docblock not attached to a seam declaration`);
  }
});

Then("every plank string matches a current step-definition pattern", function () {
  for (const finding of this.plankFindings.filter((finding) => !finding.provisional))
    assert.ok(
      this.stepPatterns.includes(finding.value),
      `${finding.path}: no current step-definition pattern "${finding.value}"`,
    );
});

Then("every provisional plank names a skeleton scenario awaiting review", function () {
  for (const finding of this.plankFindings.filter((finding) => finding.provisional))
    assert.ok(
      this.skeletonScenarios.includes(finding.value),
      `${finding.path}: provisional plank names no skeleton scenario "${finding.value}"`,
    );
});

Given("the evaluation harness support", function () {
  this.harnessSupport = { scenarioEvidenceDirectory, writeScenarioEvidence };
});

When("an evaluation scenario writes its evidence", async function () {
  this.evidenceDirectory = await this.harnessSupport.writeScenarioEvidence("An evaluation scenario", {
    status: 0,
    stdout: "stdout\n",
    stderr: "stderr\n",
    duration: 1,
  });
});

Then("the evidence path is unique to the scenario", async function () {
  assert.equal(this.evidenceDirectory, this.harnessSupport.scenarioEvidenceDirectory("An evaluation scenario"));
  assert.ok(this.evidenceDirectory.includes("an-evaluation-scenario"));
  assert.notEqual(this.evidenceDirectory, this.harnessSupport.scenarioEvidenceDirectory("A different evaluation scenario"));
  const files = await readdir(this.evidenceDirectory);
  for (const file of ["exit-status", "stdout", "stderr", "duration", "session.jsonl"])
    assert.ok(files.includes(file));
});
