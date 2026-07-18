import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Given, When, Then } from "@cucumber/cucumber";

Given("the Yoink package manifest declares direct dependencies", async function () {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  this.dependencies = Object.entries({ ...manifest.dependencies, ...manifest.devDependencies });
});

When("the verifier compares each declared version to npm's {string} release", async function (tag) {
  this.comparisons = await Promise.all(this.dependencies.map(async ([name, declared]) => {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
    assert.equal(response.ok, true, `npm registry request for ${name} returned ${response.status}`);
    const metadata = await response.json();
    return { name, declared, published: metadata["dist-tags"][tag] };
  }));
});

Then("every declared dependency version equals npm's latest stable release", function () {
  for (const { name, declared, published } of this.comparisons) {
    assert.equal(declared, published, `${name} declares ${declared}; npm latest is ${published}`);
  }
});
