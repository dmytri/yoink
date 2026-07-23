# @dk/yoink

[![skills.sh](https://skills.sh/b/dmytri/yoink)](https://skills.sh/dmytri/yoink)

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
|---|---|---|---|
| `label` | yes | string | Human-readable name for the result |
| `run` | yes | string | Shell command to execute |
| `cwd` | no | string | Working directory, relative to Yoink's starting directory or absolute |
| `timeout` | no | number | Kill the command after this many seconds (default: 1) |
| `pipe` | no | boolean | Pipe this command's stdout to the next command's stdin |
| `capture` | no | boolean | Include stdout in the bundle. Default: `true` unless `pipe` is `true`. Set `false` to suppress output when only side effects matter |

The default command timeout is 1 second. Set `timeout` explicitly for commands that may take longer. Prefer a bounded value such as `5` or `10` seconds over relying on the default.

Use `--max-bytes <n>` to limit each command's captured stdout and stderr stream independently. It is not a total bundle-size limit. Prefer limiting output at the source with focused patterns or `head`; Yoink records stdout and stderr truncation in result metadata.

```sh
npx @dk/yoink --max-bytes 100000 - <<'JSON'
{"commands":[{"label":"Instructions","run":"cat -- AGENTS.md"}]}
JSON
```

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

When a plan is shown inside Markdown instructions or an agent skill, prefer a quoted heredoc. It keeps the plan, commands, and trust review together without requiring a temporary file:

```sh
npx @dk/yoink - <<'JSON'
{
  "commands": [
    {"label":"Instructions","run":"cat -- AGENTS.md"},
    {"label":"Source paths","run":"rg --files src"}
  ]
}
JSON
```

Use a plan file when the plan is reused, large, editor-validated with `$schema`, or needs to persist as a repository artifact.

Yoink still parses the JSON after the heredoc reaches it. Escape backslashes for JSON string values, even with a quoted heredoc. For example, write `\\K` in JSON when the command must receive `\K`.

By default (`--pipefail`), Yoink exits non-zero if any piped producer fails. Use `--no-pipefail` to accept a failed piped producer when the consumer succeeds.

Commands execute serially in array order. A plan-level pipe connects one command to the next command's stdin; it does not make unrelated commands concurrent.

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

Capture choices affect bundle size. Yoink includes metadata, stdout bytes, and stderr bytes for every command. Use `capture: false` when a command's stdout is noisy or only its status matters. A piped command defaults to `capture: false`; a standalone command defaults to `capture: true`.

## Choosing command boundaries

Use a new plan command when an operation deserves its own label, metadata, timeout, captured output, or failure status. Use shell operators inside `run` when several shell operations form one atomic result.

- Use plan-level `"pipe": true` when a later command consumes earlier stdout and both results need separate observability or pipefail handling.
- Use shell `|` for a small private transformation where only the final output matters. Internal stages then share one Yoink result.
- Use `&&` when setup and the following operation must succeed as one result.
- Use separate commands for independent retrievals or when each result needs its own timeout or diagnostics.
- Use `;` sparingly because it continues after failure and reports only the final shell status.
- Use `||` only for one logical fallback. Split it when primary and fallback results need separate visibility.
- Avoid `&` in plans. Background processes can outlive the command, race with later steps, leak resources, and produce incomplete output.

The plan-level pipe connects stdout to stdin. It does not turn output into command arguments automatically. Use a consumer such as `xargs` when data must become arguments:

```json
{
  "commands": [
    {
      "label": "Changed files",
      "run": "git diff --name-only -z",
      "pipe": true
    },
    {
      "label": "Changed TypeScript files",
      "run": "xargs -0 -r rg -n 'TODO|FIXME'"
    }
  ]
}
```

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

Yoink writes a multipart MIME bundle to standard output. Each command result appears as three parts: JSON metadata (`index`, `label`, `command`, `cwd`, `exitCode`, `signal`, `durationMs`, `timeoutSeconds`, `timedOut`, `stdout_truncated`, `stderr_truncated`, `pipeClosed`), stdout bytes, and stderr bytes. Stream bytes are preserved verbatim.

## Consuming the bundle

Redirect standard output to a file when another process or agent will parse the result. Keep standard error separate because it contains Yoink diagnostics:

```sh
yoink plan.json > bundle.eml 2> yoink-errors.log
```

Parse the output as MIME. Do not split it on the boundary string or decode the body as text. Each command contributes three parts in order:

1. `metadata` contains one JSON object that identifies the command and its status.
2. `stdout` contains the command's captured bytes.
3. `stderr` contains the command's error bytes.

For example, Python's standard MIME parser exposes each part without changing binary content:

```python
from email import policy
from email.parser import BytesParser

with open("bundle.eml", "rb") as stream:
    bundle = BytesParser(policy=policy.default).parse(stream)

for part in bundle.walk():
    if part.get_content_maintype() == "multipart":
        continue
    name = part.get_param("name", header="content-disposition")
    body = part.get_payload(decode=True)
    print(name, len(body or b""))
```

Use the metadata `index` or `label` to associate each stdout and stderr part with its command. A failed command still has a result in the bundle; use its metadata status fields and Yoink's process exit code to decide whether the retrieval succeeded.

For programmatic parsing, inspect each MIME part's `Content-Disposition` header. The `name` values are `metadata`, `stdout`, and `stderr`, repeated in that order for each command. Read `metadata` as JSON and keep `stdout` and `stderr` as bytes until the consumer knows they are text.

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

If Yoink cannot be installed or `npx` cannot run it, tell the user that the Yoink skill could not be run. A simple Bash fallback is:

```sh
printf '%s\n' '--- AGENTS.md ---'
cat -- AGENTS.md
printf '%s\n' '--- README.md ---'
cat -- README.md
printf '%s\n' '--- source files ---'
rg --files src
```

This fallback produces plain text, not Yoink's multipart bundle, and does not provide plan metadata or failure aggregation.

## Security

Plans are trusted shell code executed by a POSIX shell. Yoink runs each `run` value as supplied. Review plans before running them. Yoink provides no sandboxing and does not support interactive terminal programs.

## Built with Shipshape

This repository uses [Shipshape](https://github.com/dmytri/shipshape), a context-isolated spec-driven workflow for coding agents. Install with `npx skills add dmytri/shipshape --skill '*'`, or the experimental open-plugin build with `npx plugins add dmytri/shipshape`.
