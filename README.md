# @dk/yoink

> Yoink executes a retrieval plan and bundles the results into a model-ready multipart MIME bundle.

Run many context-retrieval commands in one agent tool call, then return one structured bundle.

Agents often need several files, searches, and environment details before they can act. Yoink runs those stable retrievals in one call and returns one labelled bundle, reducing invocation overhead, orchestration latency, repeated context overhead, and intermediate model decisions.

## Why Yoink?

- One retrieval call instead of several sequential calls
- One consistent bundle for the agent to consume
- Ordered commands, pipelines, timeouts, and failure metadata

## Install

```sh
npm install --global @dk/yoink
```

Yoink requires Node.js 22 or later and a POSIX shell.

## Plans

A plan is a JSON object with an ordered `commands` array. Each command is an object with these fields:

For editor validation and completion, add the published Yoink schema:

```json
{
  "$schema": "https://unpkg.com/@dk/yoink@0.1/plan.schema.json",
  "commands": []
}
```

The schema describes structural validation. Yoink additionally checks filesystem paths and pipeline placement at runtime. Print the installed schema with `yoink --schema`.

| Field | Required | Type | Description |
|---|---|---|---|---|
| `label` | yes | string | Human-readable name for the result |
| `run` | yes | string | Shell command to execute |
| `cwd` | no | string | Working directory, relative to Yoink's starting directory or absolute |
| `timeout` | no | number | Kill the command after this many seconds (default: 1) |
| `pipe` | no | boolean | Pipe this command's stdout to the next command's stdin |
| `capture` | no | boolean | Include stdout in the bundle. Default: `true` unless `pipe` is `true`. Set `false` to suppress output when only side effects matter |

```json
{
  "commands": [
    {
      "label": "Agent instructions",
      "run": "cat -- AGENTS.md",
      "pipe": true
    },
    {
      "label": "Piped paths",
      "run": "sed 's/^/File: /'"
    },
    {
      "label": "Relevant references",
      "run": "rg -n 'retrieval plan|context bundle' .",
      "cwd": ".",
      "timeout": 30
    }
  ]
}
```

Run a file or provide the plan on standard input:

```sh
yoink plan.json
cat plan.json | yoink -
yoink <<'JSON'
{"commands":[{"label":"Instructions","run":"cat -- AGENTS.md"}]}
JSON
```

By default (`--pipefail`), Yoink exits non-zero if any piped producer fails. Use `--no-pipefail` to accept a failed piped producer when the consumer succeeds.

## Piping

Set `"pipe": true` on a command to connect its standard output to the next command's standard input. This works chained: command A pipes to B, B pipes to C.

By default, a piped command's stdout is **omitted** from the output bundle — it streams to the next command instead. Set `"capture": true` to include it in the bundle too.

`capture` is valid on any command. Its default is `true` unless `pipe` is `true`. Use `"capture": false` to suppress stdout when only side effects matter (e.g. writing a file, seeding a database).

```json
{
  "commands": [
    {
      "label": "List source",
      "run": "rg --files src",
      "pipe": true,
      "capture": true
    },
    {
      "label": "Transform",
      "run": "sed 's/^/  /'"
    }
  ]
}
```

Without `capture: true`, the first command's stdout still feeds the second command's stdin, but the bundle only contains the second command's stdout.

## Exit status

| Condition | Exit code |
|---|---|
| All commands succeed | 0 |
| Any command fails or times out | 1 |
| Plan is invalid | 1 |
| `--pipefail` + any piped producer fails | 1 |
| `--no-pipefail` + consumer succeeds | 0 (even if producer fails) |

Yoink always emits the complete bundle, even after a command failure or timeout. Diagnostics go to stderr.

## Output

Yoink writes a multipart MIME bundle to standard output. Each command result appears as three parts: JSON metadata (`index`, `label`, `command`, `cwd`, `exitCode`, `signal`, `durationMs`, `timeoutSeconds`, `timedOut`, `stdout_truncated`, `stderr_truncated`), stdout bytes, and stderr bytes. Stream bytes are preserved verbatim.

## Agent Skills

Install the Yoink skill for agent use:

```sh
npx skills add dmytri/yoink
```

An agent skill can batch its stable context reads into one plan:

```sh
npx @dk/yoink - <<'JSON'
{
  "commands": [
    {
      "label": "Source paths",
      "run": "rg --files src",
      "pipe": true
    },
    {
      "label": "Piped paths",
      "run": "sed 's/^/Piped path: /'"
    }
  ]
}
JSON
```

Or it can pass a supplied plan file directly:

```sh
npx @dk/yoink retrieval-plan.json
```

The agent then consumes Yoink's standard-output bundle in one inference instead of issuing one tool request per retrieval command.

## Security

Plans are trusted shell code executed by a POSIX shell. Yoink runs each `run` value as supplied. Review plans before running them. Yoink provides no sandboxing and does not support interactive terminal programs.

## Built with Shipshape

This repository uses [Shipshape](https://github.com/dmytri/shipshape), a context-isolated spec-driven workflow for coding agents. Install with `npx skills add dmytri/shipshape --skill '*'`, or the experimental open-plugin build with `npx plugins add dmytri/shipshape`.
