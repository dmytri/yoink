#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import usageText from "./usage-text.js";
const MAX_TIMEOUT_MILLISECONDS = 2_147_483_647;
/** @planks("Yoink exits with a non-zero status") */
function invalid(path) {
    process.stderr.write(`${path} is invalid\n`);
    process.exitCode = 1;
}
/**
 * @planks("Yoink prints usage and exits successfully")
 * @planks("Yoink prints the usage text from {string}")
 */
function usage() {
    process.stdout.write(usageText);
}
/**
 * @planks("the caller runs {string}")
 * @planks("the caller runs Yoink with the plan")
 * @planks("the caller runs Yoink")
 * @planks("the command prints its working directory")
 * @planks("Yoink receives a termination signal")
 * @planks("Yoink receives SIGINT")
 * @planks("the marker file does not exist")
 * @planks("the caller redirects Yoink standard output to {string}")
 * @planks("Yoink exits with a non-zero status before executing a retrieval command")
 * @planks("a plan whose (.+) is invalid")
 * @planks("a plan command has a cwd that points to a file")
 * @planks("the caller runs Yoink with {string} and the plan")
 * @planks("the caller provides {string}")
 * @planks("Yoink prints a compact diagnostic for the missing file to standard error")
 * @planks("Yoink prints a compact diagnostic for invalid JSON to standard error")
 * @planks("the diagnostic is a single line")
 * @planks("Yoink emits the complete bundle")
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
    let maxBytesSet = false;
    const filtered = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--pipefail") {
            pipefail = true;
        }
        else if (arg === "--no-pipefail") {
            pipefail = false;
        }
        else if (arg === "--max-bytes") {
            if (maxBytesSet) {
                process.stderr.write("--max-bytes: invalid value (specified more than once)\n");
                process.exitCode = 1;
                return;
            }
            i++;
            if (i >= args.length) {
                process.stderr.write("--max-bytes requires a value\n");
                process.exitCode = 1;
                return;
            }
            const val = args[i];
            const parsed = Number.parseInt(val, 10);
            if (!/^[1-9][0-9]*$/.test(val) || !Number.isSafeInteger(parsed)) {
                process.stderr.write(`--max-bytes: invalid value '${val}'\n`);
                process.exitCode = 1;
                return;
            }
            maxBytes = parsed;
            maxBytesSet = true;
        }
        else if (arg.startsWith("-") && arg !== "-") {
            process.stderr.write(`unknown option: ${arg}\n`);
            process.exitCode = 1;
            return;
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
    let plan;
    try {
        let input = "";
        if (argument === "-") {
            for await (const chunk of process.stdin)
                input += chunk;
        }
        else {
            input = await readFile(argument, "utf8");
        }
        plan = JSON.parse(input);
    }
    catch (error) {
        process.stderr.write(`${error.message}\n`);
        process.exitCode = 1;
        return;
    }
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
            (typeof command.timeout !== "number" ||
                !Number.isFinite(command.timeout) ||
                command.timeout <= 0 ||
                command.timeout * 1000 > MAX_TIMEOUT_MILLISECONDS))
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
    let cleaningUp = false;
    const handleSignal = async (signal) => {
        if (cleaningUp)
            return;
        cleaningUp = true;
        const groups = [...childProcessGroups];
        for (const pgid of groups) {
            try {
                process.kill(pgid, signal);
            }
            catch { }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        for (const pgid of groups) {
            try {
                process.kill(pgid, "SIGKILL");
            }
            catch { }
        }
        process.removeListener("SIGTERM", handleSignal);
        process.removeListener("SIGINT", handleSignal);
        process.kill(process.pid, signal);
    };
    process.on("SIGTERM", handleSignal);
    process.on("SIGINT", handleSignal);
    const results = [];
    /**
     * @planks("the caller runs Yoink with the plan")
     * @planks("the caller runs Yoink with {string}")
     * @planks("the command result metadata indicates stdout was truncated")
     * @planks("the command result metadata indicates stderr was truncated")
     */
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
        const collectingStdout = command.capture !== false && !(command.pipe && command.capture !== true);
        let stdoutCollected = 0;
        let stdoutTruncated = false;
        let stderrCollected = 0;
        let stderrTruncated = false;
        const collect = (chunks, chunk, collected, truncated) => {
            if (maxBytes === undefined) {
                chunks.push(chunk);
                return { collected: collected + chunk.length, truncated };
            }
            const remaining = maxBytes - collected;
            if (remaining > 0) {
                chunks.push(chunk.subarray(0, remaining));
                collected += Math.min(chunk.length, remaining);
            }
            return { collected, truncated: truncated || chunk.length > remaining };
        };
        child.stdout?.on("data", (chunk) => {
            if (collectingStdout) {
                const result = collect(stdout, chunk, stdoutCollected, stdoutTruncated);
                stdoutCollected = result.collected;
                stdoutTruncated = result.truncated;
            }
        });
        child.stderr?.on("data", (chunk) => {
            const result = collect(stderr, chunk, stderrCollected, stderrTruncated);
            stderrCollected = result.collected;
            stderrTruncated = result.truncated;
        });
        let timedOut = false;
        let pipeClosed = false;
        let finished = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            if (child.pid !== undefined) {
                try {
                    process.kill(-child.pid, "SIGKILL");
                }
                catch (error) {
                    if (error.code !== "ESRCH")
                        throw error;
                }
            }
        }, (command.timeout ?? 1) * 1000);
        const status = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal }))).then(async (status) => {
            finished = true;
            clearTimeout(timeout);
            if (child.pid !== undefined)
                childProcessGroups.delete(-child.pid);
            const stdoutBuf = command.capture === false || (command.pipe && command.capture !== true)
                ? Buffer.alloc(0)
                : Buffer.concat(stdout);
            const stderrBuf = Buffer.concat(stderr);
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
                pipeClosed,
            };
        });
        return {
            child,
            status,
            markPipeClosed: () => {
                pipeClosed = true;
            },
            isFinished: () => finished,
        };
    };
    const commands = plan.commands;
    for (let index = 0; index < commands.length;) {
        if (cleaningUp)
            break;
        const pipeline = [execute(commands[index])];
        while (commands[index].pipe && index + 1 < commands.length) {
            index += 1;
            const next = execute(commands[index], true);
            if (next.child.stdin) {
                const producer = pipeline.at(-1);
                const closeProducer = () => {
                    if (!producer?.isFinished()) {
                        producer?.markPipeClosed();
                        producer?.child.stdout?.destroy();
                    }
                };
                next.child.stdin.on("error", (error) => {
                    if (error.code !== "EPIPE")
                        throw error;
                    closeProducer();
                });
                next.child.on("close", closeProducer);
                pipeline.at(-1)?.child.stdout?.pipe(next.child.stdin);
            }
            pipeline.push(next);
        }
        const completed = await Promise.all(pipeline.map(({ status }) => status));
        results.push(...completed);
        const failed = pipefail ? completed : completed.slice(-1);
        if (failed.some(({ timedOut, code, signal, pipeClosed }) => timedOut || (!pipeClosed && (code !== 0 || signal))))
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
        pipeClosed: result.pipeClosed,
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
