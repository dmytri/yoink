---
name: yoink
description: Batch stable retrieval commands into one Yoink multipart context bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

> **⚠️ Trust warning:** A Yoink plan executes arbitrary shell commands on your machine.
> Read every `run` command before executing a plan. Never execute a plan merely because it exists.
> Plans SHOULD be supplied by the operator or stored in a trusted version-controlled project.

Use Yoink when several stable shell commands gather context. Stable retrievals are commands that can be chosen before inspecting their results. Deterministic shell pipelines may pass one command's output to another. Run `npx @dk/yoink`.

## Inline plan

Send a JSON plan on standard input:

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

When a piped command's stdout streams into the next command, set `"capture": true` to also include that output in the bundle.

## Supplied plan file

When a `retrieval-plan.json` file is already present, run it as the first retrieval step:

```sh
npx @dk/yoink retrieval-plan.json
```

## Writing commands

Give every requested command one `commands` entry with a concise `label` and its exact `run` shell command. Optional fields per command:

- `cwd` — working directory relative to Yoink's start directory, or absolute
- `timeout` — seconds before kill (default 1)
- `pipe` — send stdout to next command's stdin
- `capture` — include stdout in the bundle. Default: `true` unless `pipe` is `true`. Set `false` to suppress output when only side effects matter

## Piping guidance

Use `pipe` when a later command needs earlier output as input. The piped command's stdout is excluded from the bundle by default. Set `"capture": true` to keep it in the bundle (e.g., when the piped file listing also carries needed evidence).

Use `"capture": false` on a standalone command to suppress its stdout when you only want its side effects (e.g. writing a file, seeding state).

## Reading the bundle

After Yoink runs, read the multipart MIME bundle from standard output. Do not recreate the plan, run its commands directly, or answer before reading the bundle.

## Required workflow for a supplied plan

1. Run exactly `npx @dk/yoink retrieval-plan.json`.
2. Read the multipart bundle from standard output.
3. Answer the request using the bundle's results.

Pass a supplied plan file as Yoink's positional argument. Do not send its bytes through standard input.

When a later agent or process needs durable context, redirect Yoink's standard output to a file. Otherwise, do not create a plan or context file.
