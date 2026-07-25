import assert from "node:assert/strict";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Given, When, Then } from "@cucumber/cucumber";

async function runFlags(world) {
	world.directory ??= await mkdtemp(join(tmpdir(), "yoink-flag-"));
	const args = world.flagArgs || [];
	const child = spawn(
		process.execPath,
		[join(process.cwd(), "dist/cli.js"), ...args],
		{
			cwd: world.directory,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const collect = (stream) =>
		new Promise((resolve) => {
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

Given("the caller provides {string} and {string}", async function (flag, value) {
	this.flagArgs ??= [];
	if (flag === "--cwd" && value) {
		this.directory = await mkdtemp(join(tmpdir(), "yoink-flag-cwd-"));
		await mkdir(join(this.directory, value));
		this.expectedDirectory = join(this.directory, value);
	}
	this.flagArgs.push(flag, value);
});

Given("the caller provides the flag {string}", function (flag) {
	this.flagArgs ??= [];
	this.flagArgs.push(flag);
});

Given("the caller provides the argument {string}", function (arg) {
	this.flagArgs ??= [];
	this.flagArgs.push(arg);
});

When("the caller runs Yoink via flags", async function () {
	this.arguments = this.flagArgs || [];
	await runFlags(this);
});

When("the caller runs Yoink with the plan via flags", async function () {
	this.arguments = this.flagArgs || [];
	await runFlags(this);
});

Then("the command result label is {string}", function (label) {
	assert.match(
		this.result.stdout.toString(),
		new RegExp(`"label":"${label}"`),
	);
});

Then("Yoink executes the retrieval command via flags", function () {
	assert.equal(this.result.status, 0);
});

Then("the flag bundle contains results for both commands", function () {
	const output = this.result.stdout.toString();
	const boundary = output.match(
		/^Content-Type: multipart\/mixed; boundary=(.+)$/m,
	)?.[1];
	assert.ok(boundary);
	const metadataParts = [];
	let pos = 0;
	while (true) {
		const start = output.indexOf('name="metadata"\r\n\r\n', pos);
		if (start === -1) break;
		const bodyStart = start + 'name="metadata"\r\n\r\n'.length;
		const bodyEnd = output.indexOf(`\r\n--${boundary}`, bodyStart);
		metadataParts.push(output.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd));
		pos = bodyEnd === -1 ? output.length : bodyEnd;
	}
	assert.ok(metadataParts.length >= 2, "expected at least 2 metadata parts");
});

Then("the flag command result is marked timed out", function () {
	assert.match(this.result.stdout.toString(), /"timedOut":true/);
});

Then("the flag command result names the resolved working directory", function () {
	const output = this.result.stdout.toString();
	const expectedDir = this.expectedDirectory || this.directory;
	assert.match(output, new RegExp(`"cwd":"${expectedDir.replace(/[/\\]/g, "[/\\\\]")}"`));
});

Then("the flag command result stdout is empty", function () {
	const output = this.result.stdout.toString();
	const boundary = output.match(
		/^Content-Type: multipart\/mixed; boundary=(.+)$/m,
	)?.[1];
	assert.ok(boundary);
	const start = output.indexOf("name=\"stdout\"\r\n\r\n");
	assert.ok(start !== -1, "stdout part not found");
	const bodyStart = start + "name=\"stdout\"\r\n\r\n".length;
	const bodyEnd = output.indexOf(`\r\n--${boundary}`, bodyStart);
	const body = output.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd);
	assert.equal(body, "");
});

Then("the first command result has pipe enabled", function () {
	const output = this.result.stdout.toString();
	const boundary = output.match(
		/^Content-Type: multipart\/mixed; boundary=(.+)$/m,
	)?.[1];
	assert.ok(boundary);
	const stdoutBodies = [];
	let pos = 0;
	while (true) {
		const start = output.indexOf("name=\"stdout\"\r\n\r\n", pos);
		if (start === -1) break;
		const bodyStart = start + "name=\"stdout\"\r\n\r\n".length;
		const bodyEnd = output.indexOf(`\r\n--${boundary}`, bodyStart);
		stdoutBodies.push(output.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd));
		pos = bodyEnd === -1 ? output.length : bodyEnd;
	}
	assert.ok(stdoutBodies.length >= 2, "expected at least 2 stdout parts");
	assert.equal(stdoutBodies[0], "");
});

Then("the command result stdout is empty", function () {
	const output = this.result.stdout.toString();
	const boundary = output.match(
		/^Content-Type: multipart\/mixed; boundary=(.+)$/m,
	)?.[1];
	assert.ok(boundary);
	const start = output.indexOf("name=\"stdout\"\r\n\r\n");
	assert.ok(start !== -1, "stdout part not found");
	const bodyStart = start + "name=\"stdout\"\r\n\r\n".length;
	const bodyEnd = output.indexOf(`\r\n--${boundary}`, bodyStart);
	const body = output.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd);
	assert.equal(body, "");
});

Then(
	"Yoink prints a diagnostic for the misplaced global flag to standard error",
	function () {
		assert.match(
			this.result.stderr.toString(),
			/before.*--run|--run.*first|global.*before|must be specified before/i,
		);
	},
);

Then(
	"Yoink prints a diagnostic for the missing --run to standard error",
	function () {
		assert.match(
			this.result.stderr.toString(),
			/requires.*preceding.*--run|missing.*--run|--label.*--run|preceding/i,
		);
	},
);

Then(
	"Yoink prints a diagnostic for the empty command to standard error",
	function () {
		assert.match(
			this.result.stderr.toString(),
			/non-empty|empty.*command|--run.*requires|empty/i,
		);
	},
);

Then(
	"Yoink prints a diagnostic for the mixed input modes to standard error",
	function () {
		assert.match(
			this.result.stderr.toString(),
			/cannot mix|mix.*--run|plan.*file.*--run|input mode/i,
		);
	},
);
