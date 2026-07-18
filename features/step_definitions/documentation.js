import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Given, When, Then } from "@cucumber/cucumber";

Given("the published package documentation", function () {});

When("the reader opens the Yoink README", async function () {
  this.documentation = await readFile("README.md", "utf8");
});

Then("it states {string}", function (statement) {
  assert.ok(this.documentation.includes(statement));
});

Then("it describes the invocation-tax problem, JSON plans, file and standard-input use, multipart output, and exit statuses", function () {
  for (const text of ["invocation", "JSON", "yoink plan.json", "yoink -", "multipart", "exit"]) assert.ok(this.documentation.includes(text));
});

Then("it warns that plans execute trusted shell code", function () {
  assert.match(this.documentation, /trusted shell code/i);
});

Then("it includes a concise agent-skill example", function () {
  assert.match(this.documentation, /agent/i);
});
