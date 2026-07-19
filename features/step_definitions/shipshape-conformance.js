import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
