#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
/** @planks("Yoink exits with a non-zero status") */
function invalid(path) {
    process.stderr.write(`${path} is invalid\n`);
    process.exitCode = 1;
}
function usage() {
    process.stdout.write([
        "usage: yoink [--pipefail|--no-pipefail] [--max-bytes <n>] <plan>",
        "",
        'A plan is a JSON file or stdin stream with a "commands" array.',
        'Each command needs "label" and "run". Optional fields:',
        "  cwd       working directory (relative to Yoink's CWD)",
        "  timeout   seconds before the command is killed (default: 1)",
        "  pipe      send stdout to the next command's stdin",
        "  capture   include a piped command's stdout in the output bundle",
        "",
        "Examples:",
        "  yoink plan.json",
        "  cat plan.json | yoink -",
        "  yoink --pipefail plan.json",
        "  yoink --no-pipefail plan.json",
        "",
    ].join("\n"));
}
/**
 * @planks("the caller runs {string}")
 * @planks("the caller runs Yoink with the plan")
 * @planks("the caller runs Yoink")
 * @planks("the command prints its working directory")
 * @planks("Yoink receives a termination signal")
 * @planks("Yoink receives SIGINT")
 * @planks("the caller redirects Yoink standard output to {string}")
 * @planks("Yoink exits with a non-zero status before executing a retrieval command")
 * @planks("a plan whose (.+) is invalid")
 * @planks("a plan command has a cwd that points to a file")
 * @planks("the caller runs Yoink with {string} and the plan")
 * @planks("the caller provides {string}")
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.includes("--help")) {
        usage();
        return;
    }
    if (args.includes("--version")) {
        const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
        process.stdout.write(`${pkg.version}\n`);
        return;
    }
    let pipefail = true;
    let maxBytes;
    const filtered = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--pipefail") {
            pipefail = true;
        }
        else if (arg === "--no-pipefail") {
            pipefail = false;
        }
        else if (arg === "--max-bytes" && i + 1 < args.length) {
            maxBytes = Number.parseInt(args[++i], 10);
        }
        else {
            filtered.push(arg);
        }
    }
    if (filtered.length > 1) {
        process.stderr.write(`unexpected argument: ${filtered[1]}\n`);
        process.exitCode = 1;
        return;
    }
    const argument = filtered[0];
    if (argument === undefined) {
        usage();
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
        if ("pipe" in command) {
            if (typeof command.pipe !== "boolean")
                return invalid(`${path}.pipe`);
            if (command.pipe && index === plan.commands.length - 1)
                return invalid(`${path}.pipe`);
        }
        if ("capture" in command && typeof command.capture !== "boolean")
            return invalid(`${path}.capture`);
    }
    const childProcessGroups = new Set();
    const sigterm = () => {
        for (const pgid of childProcessGroups) {
            try {
                process.kill(pgid, "SIGTERM");
            }
            catch { }
        }
        process.removeListener("SIGTERM", sigterm);
        process.kill(process.pid, "SIGTERM");
    };
    process.on("SIGTERM", sigterm);
    const sigint = () => {
        for (const pgid of childProcessGroups) {
            try {
                process.kill(pgid, "SIGINT");
            }
            catch { }
        }
        process.removeListener("SIGINT", sigint);
        process.kill(process.pid, "SIGINT");
    };
    process.on("SIGINT", sigint);
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
        if (child.pid !== undefined)
            childProcessGroups.add(-child.pid);
        const stdout = [];
        const stderr = [];
        child.stdout?.on("data", (chunk) => stdout.push(chunk));
        child.stderr?.on("data", (chunk) => stderr.push(chunk));
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            if (child.pid !== undefined) {
                process.kill(-child.pid, "SIGKILL");
            }
        }, (command.timeout ?? 1) * 1000);
        const status = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal }))).then(async (status) => {
            clearTimeout(timeout);
            if (child.pid !== undefined)
                childProcessGroups.delete(-child.pid);
            let stdoutBuf = command.capture === false || (command.pipe && command.capture !== true)
                ? Buffer.alloc(0)
                : Buffer.concat(stdout);
            let stderrBuf = Buffer.concat(stderr);
            let stdoutTruncated = false;
            let stderrTruncated = false;
            if (maxBytes !== undefined) {
                if (stdoutBuf.length > maxBytes) {
                    stdoutBuf = stdoutBuf.subarray(0, maxBytes);
                    stdoutTruncated = true;
                }
                if (stderrBuf.length > maxBytes) {
                    stderrBuf = stderrBuf.subarray(0, maxBytes);
                    stderrTruncated = true;
                }
            }
            return {
                command,
                cwd: command.cwd ? await realpath(command.cwd) : process.cwd(),
                stdout: stdoutBuf,
                stderr: stderrBuf,
                ...status,
                duration: Date.now() - startedAt,
                timedOut,
                stdoutTruncated,
                stderrTruncated,
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
    const metadata = (result, index) => Buffer.from(JSON.stringify({
        index,
        label: result.command.label,
        command: result.command.run,
        cwd: result.cwd,
        exitCode: result.code,
        signal: result.signal,
        durationMs: result.duration,
        timeoutSeconds: result.command.timeout ?? 1,
        timedOut: result.timedOut,
        stdout_truncated: result.stdoutTruncated,
        stderr_truncated: result.stderrTruncated,
    }));
    const bodies = results.flatMap((result, i) => [
        metadata(result, i),
        result.stdout,
        result.stderr,
    ]);
    let boundary = `yoink-${randomUUID()}`;
    while (bodies.some((body) => body.includes(boundary)))
        boundary = `yoink-${randomUUID()}`;
    const crlf = "\r\n";
    const parts = [
        Buffer.from(`Content-Type: multipart/mixed; boundary=${boundary}${crlf}${crlf}`),
    ];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        parts.push(Buffer.from(`--${boundary}${crlf}Content-Type: application/json${crlf}Content-Disposition: form-data; name="metadata"${crlf}${crlf}`), metadata(result, i));
        parts.push(Buffer.from(`${crlf}--${boundary}${crlf}Content-Type: application/octet-stream${crlf}Content-Disposition: form-data; name="stdout"${crlf}${crlf}`), result.stdout);
        parts.push(Buffer.from(`${crlf}--${boundary}${crlf}Content-Type: application/octet-stream${crlf}Content-Disposition: form-data; name="stderr"${crlf}${crlf}`), result.stderr);
    }
    parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));
    process.stdout.write(Buffer.concat(parts));
}
await main();
