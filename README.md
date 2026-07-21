# @dk/yoink

> Yoink executes a retrieval plan and bundles the results into model-ready multipart Markdown.

Agents often need several predictable retrieval commands before they can act. Calling those commands one at a time costs a model invocation per command. Yoink runs an ordered retrieval plan in one process and returns one complete bundle.

## Install

```sh
npm install --global @dk/yoink
```

Yoink requires Node.js 22 or later and a POSIX shell.

## Plans

A plan is JSON with an ordered `commands` array. Every command has a human-readable `label` and an exact shell command in `run`. Commands may set `cwd`, resolved from Yoink's starting directory, and `timeout` in seconds. Commands without a timeout use one second.

```json
{
  "commands": [
    {
      "label": "Agent instructions",
      "run": "cat -- AGENTS.md"
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

## Output and Exit Status

Yoink writes a `YOINK-BUNDLE 1` MIME-style multipart bundle to standard output. Each stdout and stderr stream is a separate part with the command label, exact command, resolved working directory, exit code, duration, and timeout state. Stream bytes are preserved without Markdown escaping or normalization.

Yoink exits non-zero when the plan is invalid, or when any command fails or times out. It still emits the complete bundle after command failures and timeouts. Diagnostics about Yoink itself go to standard error.

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
