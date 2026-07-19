---
name: yoink
description: Batch stable retrieval commands into one Yoink multipart context bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

Use Yoink when several requested shell commands gather context. Run every requested command in one JSON plan supplied on standard input:

```sh
yoink - <<'JSON'
{"commands":[{"label":"Instructions","run":"cat -- AGENTS.md"}]}
JSON
```

Give every requested command one `commands` entry with a concise `label` and its exact `run` command. Consume Yoink's multipart standard output bundle before acting on gathered context.

When a later agent or process needs durable context, redirect Yoink standard output to requested file. Otherwise, do not create a plan or context file.
