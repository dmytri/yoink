import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { Given, setDefaultTimeout, Then, When } from "@cucumber/cucumber";

setDefaultTimeout(30000);

Given("the Yoink CLI source is in {string}", async (source) => {
	await access(source);
});

When("the package build command runs", async function () {
	this.buildStatus = await new Promise((resolve) => {
		spawn("npm", ["run", "build"], { stdio: "ignore" }).on("close", resolve);
	});
});

Then("the TypeScript compiler exits successfully", function () {
	assert.equal(this.typecheckStatus ?? this.buildStatus, 0);
});

Then("the build creates {string}", async (output) => {
	await access(output);
});

Given("the generated usage module is absent", async function () {
	this.generatedUsageModule = "src/usage-text.ts";
	await rm(this.generatedUsageModule, { force: true });
});

When("the package typecheck command runs", async function () {
	this.typecheckStatus = await new Promise((resolve) => {
		spawn("npm", ["run", "typecheck"], { stdio: "ignore" }).on(
			"close",
			resolve,
		);
	});
});

Then("the generated usage module exists", async function () {
	assert.equal(this.typecheckStatus, 0);
	await access(this.generatedUsageModule);
});
