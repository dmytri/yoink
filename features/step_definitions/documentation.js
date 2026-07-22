import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Given, Then, When } from "@cucumber/cucumber";

Given("the published package documentation", () => {});

When("the reader opens the Yoink README", async function () {
	this.documentation = await readFile("README.md", "utf8");
});

Then("it states {string}", function (statement) {
	assert.ok(this.documentation.includes(statement));
});

Then(
	"it describes the invocation-tax problem, JSON plans, file and standard-input use, multipart output, and exit statuses",
	function () {
		for (const text of [
			"invocation",
			"JSON",
			"yoink plan.json",
			"yoink -",
			"multipart",
			"exit",
		])
			assert.ok(this.documentation.includes(text));
	},
);

Then("it warns that plans execute trusted shell code", function () {
	assert.match(this.documentation, /trusted shell code/i);
});

Then("it includes a concise agent-skill example", function () {
	assert.match(this.documentation, /agent/i);
});

Then(
	"it explains that the command installs the Yoink skill for agent use",
	function () {
		assert.match(
			this.documentation,
			/installs? the Yoink skill for agent use/i,
		);
	},
);

Then("the plan example table has four columns", function () {
	const table = this.documentation.match(/\|.*\|.*\|.*\|.*\|/);
	assert.ok(table, "expected a markdown table with four columns");
});

Then(
	"the primary plan example pipes the first command into the second",
	function () {
		const block = this.documentation.match(/```json\n([\s\S]*?)\n```/)?.[1];
		assert.ok(block, "expected a primary JSON example");
		const plan = JSON.parse(block);
		assert.equal(plan.commands[0].pipe, true);
		assert.ok(!("pipe" in plan.commands[1]) || plan.commands[1].pipe === false);
	},
);

Then(
	"the Node version matches the package engines requirement",
	async function () {
		const pkg = JSON.parse(await readFile("package.json", "utf8"));
		const engine = pkg.engines?.node;
		assert.ok(engine);
		const major = engine.match(/(\d+)/)?.[1];
		assert.ok(major);
		assert.match(this.documentation, new RegExp(`Node\\.?js? ${major}`));
	},
);
