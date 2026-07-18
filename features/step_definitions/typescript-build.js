import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

Given("the Yoink CLI source is in {string}", async function (source) {
  await access(source);
});

When("the package build command runs", async function () {
  this.buildStatus = await new Promise((resolve) => {
    spawn("npm", ["run", "build"], { stdio: "ignore" }).on("close", resolve);
  });
});

Then("the TypeScript compiler exits successfully", function () {
  assert.equal(this.buildStatus, 0);
});

Then("the build creates {string}", async function (output) {
  await access(output);
});
