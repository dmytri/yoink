---
name: yoink
description: Batch stable retrieval commands into one Yoink multipart context bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

Use Yoink when several requested shell commands gather context. Use `npx @dk/yoink`.

When no plan file is supplied, send an inline JSON plan through standard input:

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
      "label": "Piped path arguments",
      "run": "printf '%s\\n' \"$@\"",
      "stdin": "args"
    }
  ]
}
JSON
```

When `retrieval-plan.json` is supplied, run this as the first retrieval action:

```sh
npx @dk/yoink retrieval-plan.json
```

Required workflow for a supplied plan:

1. Run exactly `npx @dk/yoink retrieval-plan.json`.
2. Read the multipart bundle written to standard output by that command.
3. Answer the request using the bundle's results.

Pass a supplied plan file as Yoink's positional argument. Do not run its commands directly, recreate its plan, or send its bytes through standard input. Do not answer before reading the bundle.

Give every requested command one `commands` entry with a concise `label` and its exact `run` command.

When a later agent or process needs durable context, redirect Yoink standard output to requested file. Otherwise, do not create a plan or context file.
