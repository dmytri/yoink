import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { After, Before, Given, When, Then } from "@cucumber/cucumber";

const execFileAsync = promisify(execFile);
const root = process.cwd();

async function installPackage(world) {
  await execFileAsync("npm", ["pack", "--pack-destination", world.directory], { cwd: root });
  const archive = (await readdir(world.directory)).find((file) => file.endsWith(".tgz"));
  assert.ok(archive, "npm pack did not create a package archive");
  await execFileAsync("npm", ["install", "--ignore-scripts", `./${archive}`], { cwd: world.directory });
}

async function runAgent(world) {
  const prompt = [
    "Use the Yoink skill to gather the requested context.",
    "Use an inline JSON plan through standard input only when no plan file is supplied.",
    world.contextFile
      ? `Write Yoink standard output to ${world.contextFile}.`
      : "Do not create a plan or context file.",
    world.retrievalPlan
      ? `Pass ${world.retrievalPlanFile} directly to Yoink as its positional plan argument with yoink ${world.retrievalPlanFile}.`
      : "",
    "Report the gathered context after consuming Yoink standard output.",
  ].join(" ");
  const args = ["--mode", "json", "--provider", "openrouter", "--session-dir", world.sessionDirectory, "--approve", "--skill", join(world.directory, ".agents/skills/yoink/SKILL.md"), "-p", prompt];
  if (world.model ?? process.env.HARNESS_EVAL_MODEL)
    args.splice(0, 0, "--model", world.model ?? process.env.HARNESS_EVAL_MODEL);
  world.piInvocation = args;
  world.piExecutable = "node_modules/.bin/pi";
  world.piEnvironment = {
    ...process.env,
    HOME: world.homeDirectory,
    ...world.xdgDirectories,
    OPENROUTER_API_KEY: world.apiKey,
    PI_SKIP_VERSION_CHECK: "1",
    PI_TELEMETRY: "0",
  };
  const startedAt = Date.now();
  const { stdout, stderr, status } = await runPi(join(root, world.piExecutable), args, world.directory, world.piEnvironment, 360000);
  await writeEvaluation(world, { status, stdout, stderr, duration: Date.now() - startedAt });
  if (status !== 0) {
    throw new Error(JSON.stringify({ code: status, stdout, stderr, message: `Command failed: ${join(root, world.piExecutable)} ${args.join(" ")}` }));
  }
  world.events = stdout.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
  world.bash = world.events.filter((event) => event.type === "tool_execution_start" && event.toolName === "bash");
  world.output = JSON.stringify(world.events);
}

export function scenarioEvidenceDirectory(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return join(root, "coverage/eval", slug);
}

export async function writeScenarioEvidence(name, result) {
  const directory = scenarioEvidenceDirectory(name);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, "exit-status"), `${result.status}\n`),
    writeFile(join(directory, "stdout"), result.stdout),
    writeFile(join(directory, "stderr"), result.stderr),
    writeFile(join(directory, "duration"), `${result.duration}\n`),
    writeFile(join(directory, "session.jsonl"), result.stdout),
  ]);
  return directory;
}

async function writeEvaluation(world, result) {
  world.evaluationDirectory = await writeScenarioEvidence(world.scenarioName, result);
}

function runPi(piPath, args, cwd, env, timeout) {
  return new Promise((resolve) => {
    const child = spawn(piPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => child.kill("SIGTERM"), timeout);
    child.on("error", () => { clearTimeout(timer); resolve({ stdout, stderr, status: 1 }); });
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, status: signal ? signal : (code ?? 1) });
    });
  });
}

function retrievalPlanLabels(world) {
  return JSON.parse(world.retrievalPlan).commands.map((command) => command.label);
}

Before(function ({ pickle }) {
  this.scenarioName = pickle.name;
  if (pickle.steps.some((step) => step.text === 'it writes Yoink\'s standard output bundle to "context.md"'))
    this.contextFile = "context.md";
});

After(async function () {
  if (this.packageDirectory) await rm(this.packageDirectory, { recursive: true, force: true });
});

Given("the package is packed for publication", async function () {
  this.packageDirectory = await mkdtemp(join(tmpdir(), "yoink-pack-"));
  const { stdout } = await execFileAsync("npm", ["pack", "--json", "--pack-destination", this.packageDirectory], { cwd: root });
  const result = JSON.parse(stdout);
  const pack = Array.isArray(result) ? result[0] : Object.values(result)[0];
  this.packageFiles = pack.files.map(({ path }) => path);
});

When("the package manifest is checked", async function () {
  const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  this.packageExports = packageJson.exports;
});

Then("the package contains {string}", function (path) {
  assert.ok(this.packageFiles.includes(path), `package does not contain ${path}`);
});

Then("the package exports {string} to {string}", function (entry, path) {
  assert.equal(this.packageExports[entry], `./${path}`);
});

Given("a baseline agent has the Yoink skill from {string} in a temporary workspace", { timeout: 120000 }, async function (skill) {
  this.directory = await mkdtemp(join(tmpdir(), "yoink-agent-"));
  await writeFile(join(this.directory, "AGENTS.md"), "# Fixture instructions\n");
  await writeFile(join(this.directory, "README.md"), "Yoink accepts standard input.\n");
  await execFileAsync("git", ["init", "--quiet"], { cwd: this.directory });
  await cp(join(root, skill), join(this.directory, ".agents/skills/yoink"), { recursive: true });
  await installPackage(this);
});

Given("the baseline agent runs under a throwaway home directory", async function () {
  this.homeDirectory = await mkdtemp(join(tmpdir(), "yoink-agent-home-"));
});

Given("the baseline agent runs {string} with isolated XDG directories", async function (executable) {
  assert.equal(executable, "node_modules/.bin/pi");
  const directory = join(this.homeDirectory, "xdg");
  this.xdgDirectories = {
    XDG_CACHE_HOME: join(directory, "cache"),
    XDG_CONFIG_HOME: join(directory, "config"),
    XDG_DATA_HOME: join(directory, "data"),
    XDG_STATE_HOME: join(directory, "state"),
  };
  await Promise.all(Object.values(this.xdgDirectories).map((path) => mkdir(path, { recursive: true })));
});

Given("the baseline agent receives its API key and model from Yoink's {string} file", async function (file) {
  const environment = await readFile(join(root, file), "utf8");
  const values = Object.fromEntries(
    environment.split("\n").flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  assert.ok(values.HARNESS_OPENROUTER_API_KEY, "HARNESS_OPENROUTER_API_KEY is required");
  assert.ok(values.HARNESS_EVAL_MODEL, "HARNESS_EVAL_MODEL is required");
  this.apiKey = values.HARNESS_OPENROUTER_API_KEY;
  this.model = values.HARNESS_EVAL_MODEL;
});

Given("the baseline agent starts Pi with the configured OpenRouter provider, task prompt, and session directory", async function () {
  assert.ok(this.apiKey, "OpenRouter API key is configured");
  assert.ok(this.model, "OpenRouter model is configured");
  this.sessionDirectory = await mkdtemp(join(tmpdir(), "yoink-agent-session-"));
});

Given("the agent receives the verbatim retrieval plan in {string}", async function (file) {
  this.retrievalPlan = await readFile(join(root, file), "utf8");
  this.retrievalPlanFile = join(this.directory, "retrieval-plan.json");
  await writeFile(this.retrievalPlanFile, this.retrievalPlan);
});

When("the agent gathers the requested context", { timeout: 370000 }, async function () {
  await runAgent(this);
});

Then("it passes the verbatim retrieval plan to Yoink as its positional argument", function () {
  assert.ok(this.bash.some((event) =>
    event.args.command.includes("npx @dk/yoink") &&
    event.args.command.includes("retrieval-plan.json"),
  ));
});

Then("it invokes Yoink through npx", function () {
  assert.ok(this.bash.some((event) => event.args.command.includes("npx @dk/yoink")));
});

Then("it consumes Yoink's multipart bundle from standard output", function () {
  assert.match(this.output, /multipart\/mixed/);
});

Then("the bundle contains every retrieval-plan result", function () {
  const strings = [];
  const walk = (value) => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(this.events);
  const transcript = strings.join("\n");
  for (const label of retrievalPlanLabels(this))
    assert.match(transcript, new RegExp(`"label":"${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
});

Then("it does not create a plan or context file", async function () {
  const files = await readdir(this.directory);
  assert.equal(files.includes("plan.json"), false);
  assert.equal(files.includes("context.md"), false);
});

Then("the evaluation writes Pi exit status, standard output, standard error, duration, and session transcript under {string}", async function (directory) {
  assert.equal(dirname(this.evaluationDirectory), join(root, directory));
  const files = await readdir(this.evaluationDirectory);
  for (const file of ["exit-status", "stdout", "stderr", "duration", "session.jsonl"])
    assert.ok(files.includes(file));
});

Then("the recorded Pi executable is {string}", function (executable) {
  assert.equal(this.piExecutable, executable);
});

Then("the recorded Pi environment sets HOME, XDG_CONFIG_HOME, XDG_DATA_HOME, and XDG_CACHE_HOME under the throwaway home directory", function () {
  assert.equal(this.piEnvironment.HOME, this.homeDirectory);
  for (const key of ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "XDG_CACHE_HOME"])
    assert.ok(this.piEnvironment[key].startsWith(`${this.homeDirectory}/`));
});

Then("the recorded Pi invocation uses {string}, {string}, {string}, {string}, and {string}", function (first, second, third, fourth, fifth) {
  const invocation = this.piInvocation.join(" ");
  for (const argument of [first, second, third, fourth, fifth]) assert.ok(invocation.includes(argument));
});

Then("the recorded Pi invocation does not use {string}", function (argument) {
  assert.equal(this.piInvocation.includes(argument), false);
});

Then("the retained Pi session transcript is not empty", async function () {
  assert.notEqual((await readFile(join(this.evaluationDirectory, "session.jsonl"), "utf8")).length, 0);
});

Then("it writes Yoink's standard output bundle to {string}", async function (file) {
  assert.equal(file, this.contextFile);
  assert.match(await readFile(join(this.directory, file), "utf8"), /multipart\/mixed/);
});

Then("{string} contains every retrieval-plan result", async function (file) {
  const bundle = await readFile(join(this.directory, file), "utf8");
  for (const label of retrievalPlanLabels(this))
    assert.match(bundle, new RegExp(`"label":"${label}"`));
});
