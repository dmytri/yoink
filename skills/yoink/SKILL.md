---
name: yoink
description: Batch stable retrieval commands into one Yoink multipart context bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

Use Yoink when several stable shell commands gather context. Run `npx @dk/yoink`.

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

- `cwd` — working directory relative to Yoink's start directory
- `timeout` — seconds before kill (default 1)
- `pipe` — send stdout to next command's stdin
- `capture` — include piped stdout in the bundle

## Piping guidance

Use `pipe` when a later command needs earlier output as input. The piped command's stdout is excluded from the bundle by default. Set `"capture": true` to keep it in the bundle (e.g., when the piped file listing also carries needed evidence).

## Reading the bundle

After Yoink runs, read the multipart MIME bundle from standard output. Do not recreate the plan, run its commands directly, or answer before reading the bundle.

## Required workflow for a supplied plan

1. Run exactly `npx @dk/yoink retrieval-plan.json`.
2. Read the multipart bundle from standard output.
3. Answer the request using the bundle's results.

Pass a supplied plan file as Yoink's positional argument. Do not send its bytes through standard input.

When a later agent or process needs durable context, redirect Yoink's standard output to a file. Otherwise, do not create a plan or context file.
