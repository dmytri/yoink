---
name: yoink
description: Batch stable retrieval commands into one Yoink multipart context bundle.
---

<!-- @planks("When the agent gathers the requested context") -->
# Yoink

Use Yoink when several requested shell commands gather context. When `retrieval-plan.json` is supplied, run this as the first retrieval action:

```sh
cat -- retrieval-plan.json | ./node_modules/.bin/yoink -
```

Required workflow:

1. Run exactly `cat -- retrieval-plan.json | ./node_modules/.bin/yoink -`.
2. Read the multipart bundle written to standard output by that command.
3. Answer the request using the bundle's results.

Use the workspace-local `./node_modules/.bin/yoink` binary. Pass the plan file's bytes unchanged. Do not run the plan commands directly, recreate the plan, or replace standard input with a plan file argument. Do not answer before reading the bundle.

Give every requested command one `commands` entry with a concise `label` and its exact `run` command.

When a later agent or process needs durable context, redirect Yoink standard output to requested file. Otherwise, do not create a plan or context file.
