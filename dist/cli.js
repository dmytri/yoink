#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
/** @planks("Yoink exits with a non-zero status") */
function invalid(path) {
    process.stderr.write(`${path} is invalid\n`);
    process.exitCode = 1;
}
/**
 * @planks("the caller runs {string}")
 * @planks("the caller runs Yoink with the plan")
 * @planks("the caller runs Yoink")
 * @planks("the command prints its working directory")
 * @planks("Yoink receives a termination signal")
 * @planks("the caller redirects Yoink standard output to {string}")
 * @planks("the next command sets {string} to {string}")
 * @planks("Yoink exits with a non-zero status before executing a retrieval command")
 */
async function main() {
    const [option, planArgument] = process.argv.slice(2);
    const pipefail = option !== "--no-pipefail";
    const argument = option === "--pipefail" || option === "--no-pipefail"
        ? planArgument
        : option;
    if (argument === undefined) {
        process.stdout.write("usage: yoink [--pipefail|--no-pipefail] <plan>\n");
        return;
    }
    let input;
    if (argument === "-") {
        input = "";
        for await (const chunk of process.stdin)
            input += chunk;
    }
    else {
        input = await readFile(argument, "utf8");
    }
    const plan = JSON.parse(input);
    if (typeof plan !== "object" ||
        plan === null ||
        !("commands" in plan) ||
        !Array.isArray(plan.commands))
        return invalid("$.commands");
    for (const key of Object.keys(plan)) {
        if (key !== "commands")
            return invalid(`$.${key}`);
    }
    for (let index = 0; index < plan.commands.length; index += 1) {
        const command = plan.commands[index];
        const path = `$.commands[${index}]`;
        if (typeof command !== "object" ||
            command === null ||
            typeof command.label !== "string" ||
            command.label === "")
            return invalid(`${path}.label`);
        if (typeof command.run !== "string" || command.run === "")
            return invalid(`${path}.run`);
        for (const key of Object.keys(command)) {
            if (!["label", "run", "timeout", "cwd", "pipe", "capture"].includes(key))
                return invalid(`${path}.${key}`);
        }
        if ("timeout" in command &&
            (!(typeof command.timeout === "number") || command.timeout <= 0))
            return invalid(`${path}.timeout`);
        if ("cwd" in command) {
            if (typeof command.cwd !== "string")
                return invalid(`${path}.cwd`);
            try {
                if (!(await stat(command.cwd)).isDirectory())
                    return invalid(`${path}.cwd`);
            }
            catch {
                return invalid(`${path}.cwd`);
            }
        }
        if ("pipe" in command && typeof command.pipe !== "boolean")
            return invalid(`${path}.pipe`);
        if ("capture" in command && typeof command.capture !== "boolean")
            return invalid(`${path}.capture`);
    }
    let activeChild;
    process.once("SIGTERM", () => {
        if (activeChild?.pid !== undefined)
            process.kill(-activeChild.pid, "SIGTERM");
        process.kill(process.pid, "SIGTERM");
    });
    const results = [];
    /** @planks("the caller runs Yoink with the plan") */
    const execute = (command, piped = false) => {
        const startedAt = Date.now();
        const child = spawn(command.run, [], {
            cwd: command.cwd,
            detached: true,
            shell: true,
            stdio: [piped ? "pipe" : "ignore", "pipe", "pipe"],
        });
        activeChild = child;
        const stdout = [];
        const stderr = [];
        child.stdout?.on("data", (chunk) => stdout.push(chunk));
        child.stderr?.on("data", (chunk) => stderr.push(chunk));
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            if (child.pid !== undefined)
                process.kill(-child.pid, "SIGTERM");
        }, (command.timeout ?? 1) * 1000);
        const status = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal }))).then(async (status) => {
            clearTimeout(timeout);
            if (activeChild === child)
                activeChild = undefined;
            return {
                command,
                cwd: command.cwd ? await realpath(command.cwd) : process.cwd(),
                stdout: command.pipe && !command.capture
                    ? Buffer.alloc(0)
                    : Buffer.concat(stdout),
                stderr: Buffer.concat(stderr),
                ...status,
                duration: Date.now() - startedAt,
                timedOut,
            };
        });
        return { child, status };
    };
    const commands = plan.commands;
    for (let index = 0; index < commands.length;) {
        const pipeline = [execute(commands[index])];
        while (commands[index].pipe && index + 1 < commands.length) {
            index += 1;
            const next = execute(commands[index], true);
            if (next.child.stdin)
                pipeline.at(-1)?.child.stdout?.pipe(next.child.stdin);
            pipeline.push(next);
        }
        const completed = await Promise.all(pipeline.map(({ status }) => status));
        results.push(...completed);
        const failed = pipefail ? completed : completed.slice(-1);
        if (failed.some(({ timedOut, code, signal }) => timedOut || code !== 0 || signal))
            process.exitCode = 1;
        index += 1;
    }
    const metadata = (result) => Buffer.from(`label: ${result.command.label}\ncommand: ${result.command.run}\nworking directory: ${result.cwd}\nexit code: ${result.code}\nduration: ${result.duration}\ntimeout: ${result.timedOut ? "timed out" : "no"}\n`);
    const bodies = results.flatMap((result) => [
        metadata(result),
        result.stdout,
        result.stderr,
    ]);
    let boundary = `yoink-${randomUUID()}`;
    while (bodies.some((body) => body.includes(boundary)))
        boundary = `yoink-${randomUUID()}`;
    const parts = [
        Buffer.from(`Content-Type: multipart/mixed; boundary=${boundary}\n`),
    ];
    for (const result of results) {
        parts.push(Buffer.from(`--${boundary}\nContent-Type: text/plain\nContent-Disposition: form-data; name="metadata"\n\n`), metadata(result));
        parts.push(Buffer.from(`\n--${boundary}\nContent-Type: application/octet-stream\nContent-Disposition: form-data; name="stdout"\n\n`), result.stdout);
        parts.push(Buffer.from(`\n--${boundary}\nContent-Type: application/octet-stream\nContent-Disposition: form-data; name="stderr"\n\n`), result.stderr);
    }
    parts.push(Buffer.from(`\n--${boundary}--\n`));
    process.stdout.write(Buffer.concat(parts));
}
await main();
