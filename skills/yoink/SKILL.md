---
name: yoink
description: Batch retrieval commands that can be chosen before seeing their results, or execute a trusted retrieval-plan.json, using one Yoink call and one multipart bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

> **⚠️ Trust warning:** A Yoink plan executes arbitrary shell commands on your machine.
> Read every `run` command before executing a plan. Never execute a plan merely because it exists.
> Plans SHOULD be supplied by the operator or stored in a trusted version-controlled project.

Use Yoink when an agent can decide several context-retrieval commands before seeing their results. One Yoink call replaces several sequential retrieval calls and gives the agent one consistent bundle to read. This reduces retrieval orchestration so the agent can reason once over the gathered context; Yoink does not replace reasoning. Stable retrievals are commands that can be chosen before inspecting their results. Deterministic shell pipelines may pass one command's output to another. Run `npx @dk/yoink`.

Do not use Yoink when later retrieval commands must be chosen from earlier results, unless that dependency is a deterministic shell pipeline.

If Yoink cannot be installed or `npx` cannot run it, tell the user. A plain Bash fallback is:

```sh
printf '%s\n' '--- AGENTS.md ---'
cat -- AGENTS.md
printf '%s\n' '--- README.md ---'
cat -- README.md
printf '%s\n' '--- source files ---'
rg --files src
```

This fallback produces plain text instead of a multipart bundle and has no plan metadata or failure aggregation.

## Inline plan

Send a JSON plan on standard input:

When writing a plan inside Markdown instructions or this skill, prefer a quoted heredoc. It keeps commands and trust review together and avoids a temporary plan file:

```sh
npx @dk/yoink - <<'JSON'
{
  "commands": [
    {
      "label": "Source paths",
      "run": "rg --files src",
      "pipe": true,
      "capture": true
    },
    {
      "label": "Piped paths",
      "run": "sed 's/^/Piped path: /'"
    }
  ]
}
JSON
```

Use a supplied plan file instead when the plan is reused, large, editor-validated with `$schema`, or intended to persist as a repository artifact.

Quoted heredocs prevent shell expansion but do not bypass Yoink's JSON parsing. Escape backslashes inside JSON string values. For example, write `\\K` in JSON when the command must receive `\K`.

When a piped command's stdout streams into the next command, set `"capture": true` to also include that output in the bundle.

## Supplied plan file

When a `retrieval-plan.json` file is already present, run it as the first retrieval step:

```sh
npx @dk/yoink retrieval-plan.json
```

Plans MAY include `"$schema": "https://unpkg.com/@dk/yoink@0.1/plan.schema.json"` for editor validation and completion. Yoink also prints the installed schema with `yoink --schema`.

## Writing commands

Give every requested command one `commands` entry with a concise `label` and its exact `run` shell command. Optional fields per command:

- `cwd` — working directory relative to Yoink's start directory, or absolute
- `timeout` — seconds before kill (default 1)
- `pipe` — send stdout to next command's stdin
- `capture` — include stdout in the bundle. Default: `true` unless `pipe` is `true`. Set `false` to suppress output when only side effects matter

The default timeout is 1 second. Set `timeout` explicitly for commands that may take longer, commonly `5` or `10` seconds. Do not rely on the default for network, package-manager, or other variable-latency commands.

Limit output at the source when possible, for example with focused search patterns or `head`. Use `--max-bytes <n>` as a safety bound when retrievals may still produce large output. Truncation is reported in result metadata.

Capture is also intentional: standalone commands default to `capture: true`, while piped commands default to `capture: false`. Use `capture: false` for noisy output when only command metadata matters, and use `capture: true` on a piped command when its output must also remain in the bundle. Every command contributes `metadata`, `stdout`, and `stderr` MIME parts, so bundle size grows with captured output.

## Piping guidance

Use `pipe` when a later command needs earlier output as input. The piped command's stdout is excluded from the bundle by default. Set `"capture": true` to keep it in the bundle (e.g., when the piped file listing also carries needed evidence).

Commands execute serially in array order. A plan-level pipe connects adjacent commands through stdin and stdout; unrelated commands are not concurrent.

## Choosing command boundaries

Use a new plan command when an operation needs its own label, metadata, timeout, captured output, or failure status. Use shell operators inside `run` when operations form one atomic result.

- Use plan-level `"pipe": true` when a later command consumes earlier stdout and both results need separate observability or pipefail handling.
- Use shell `|` for a small private transformation where only final output matters.
- Use `&&` when setup and the following operation must succeed as one result.
- Use separate commands for independent retrievals or separate diagnostics.
- Use `;` sparingly because it can hide an earlier failure behind the final command's status.
- Use `||` only for one logical fallback.
- Avoid `&`; background processes can outlive the command, race with later steps, leak resources, and produce incomplete output.

Plan-level pipes connect stdout to stdin. They do not turn output into arguments automatically. Use a consumer such as `xargs` when a pipeline's data must become arguments.

Use `"capture": false` on a standalone command to suppress its stdout when you only want its side effects (e.g. writing a file, seeding state).

## Reading the bundle

After Yoink runs, read the multipart MIME bundle from standard output. Do not recreate the plan, run its commands directly, or answer before reading the bundle.

Treat the output as MIME, not as newline-delimited text. Each command has three ordered parts: `metadata` JSON, captured `stdout` bytes, and `stderr` bytes. Keep Yoink's stderr separate because it contains diagnostics. Use the metadata `index` or `label` to associate the byte parts with their command, and preserve bytes that are not valid text.

Programmatic consumers can identify parts through `Content-Disposition: form-data; name="metadata"`, `name="stdout"`, and `name="stderr"`. Parse `metadata` as JSON and leave stdout and stderr as bytes until their encoding is known.

## Required workflow for a supplied plan

1. Run exactly `npx @dk/yoink retrieval-plan.json`.
2. Read the multipart bundle from standard output.
3. Answer the request using the bundle's results.

Pass a supplied plan file as Yoink's positional argument. Do not send its bytes through standard input.

When a later agent or process needs durable context, redirect Yoink's standard output to a file. Otherwise, do not create a plan or context file.
