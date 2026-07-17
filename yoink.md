Build **`@dk/yoink`**, exposing a CLI binary named **`yoink`**.

## Purpose

Agents often perform predictable retrieval sequences such as `rg`, `find`, `cat`, `git diff`, and `gh`. Each tool call normally requires another model invocation.

Yoink executes an entire retrieval plan deterministically, then emits one structured bundle for a single model inference.

## Plan format

Use JSON. Do not create a retrieval DSL or maintain command types. Each retrieval contains an exact shell command.

```json
{
  "commands": [
    {
      "label": "Agent instructions",
      "run": "cat -- AGENTS.md"
    },
    {
      "label": "Project README",
      "run": "cat -- README.md"
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

Required fields:

* `commands`: ordered array
* `label`: human-readable result label
* `run`: exact shell command

Optional fields:

* `cwd`
* `timeout`, in seconds

## CLI

Support:

```sh
yoink plan.json
cat plan.json | yoink -
yoink <<'JSON'
{
  "commands": [
    {
      "label": "Instructions",
      "run": "cat -- AGENTS.md"
    }
  ]
}
JSON
```

Write the bundle to stdout so callers can redirect it:

```sh
yoink plan.json > context.md
```

Diagnostics about Yoink itself must go to stderr.

## Execution

Execute commands in their declared order.

For each command, capture:

* label
* exact command
* working directory
* stdout
* stderr
* exit code
* duration
* timeout status

A failed command must not prevent later commands from running.

Yoink must return a non-zero process exit code when the plan is invalid or any command fails or times out, while still emitting the complete bundle.

Treat plans as executable shell code. Do not pretend they are passive configuration.

## Output format

Output a MIME-style multipart bundle. Do not wrap the complete bundle or individual results in Markdown fences because retrieved Markdown may itself contain arbitrary fences.

Example actual output:

````
YOINK-BUNDLE 1
Boundary: =_yoink_8f2c1d7a_

--=_yoink_8f2c1d7a_
Label: Agent instructions
Command: cat -- AGENTS.md
Working-Directory: /project
Exit-Code: 0
Duration-Ms: 12
Timed-Out: false
Content-Stream: stdout
Content-Type: text/markdown; charset=utf-8

# Agent instructions

```sh
npm test
````

--=*yoink_8f2c1d7a*
Label: Agent instructions
Command: cat -- AGENTS.md
Working-Directory: /project
Exit-Code: 0
Duration-Ms: 12
Timed-Out: false
Content-Stream: stderr
Content-Type: text/plain; charset=utf-8

--=*yoink_8f2c1d7a*--

```

Generate a sufficiently random boundary for every run. Before emitting the bundle, verify that the exact boundary does not occur in any captured output or metadata. Regenerate it on collision.

Preserve stdout and stderr exactly. Do not indent, escape, normalize, or rewrite retrieved content.

Emit separate multipart sections for stdout and stderr. Empty streams may either be emitted as empty sections or omitted, but choose one behaviour and document it.

## Validation

Reject:

- malformed JSON
- missing `commands`
- non-array `commands`
- missing or empty `label`
- missing or empty `run`
- invalid `cwd`
- invalid or non-positive `timeout`
- unknown top-level or command fields

Return useful validation errors with the JSON path of the invalid value.

## Implementation constraints

- TypeScript
- publishable as `@dk/yoink`
- binary name: `yoink`
- Node-compatible
- minimal runtime dependencies
- no custom retrieval types
- no Markdown parsing
- no temporary plan file required
- handle termination signals and kill active child processes
- avoid shell quoting transformations; execute the supplied command as written

## Tests

Add automated tests covering:

1. plan read from a file
2. plan read from stdin
3. multiple commands preserve order
4. Markdown containing triple and longer fences remains unchanged
5. stdout and stderr are captured separately
6. failed commands do not stop later commands
7. timeout kills the command
8. bundle exits non-zero after command failure
9. boundary collision causes regeneration
10. malformed plans produce precise errors
11. paths and labels containing Unicode
12. output redirected to a file is identical to stdout bytes

Add an integration test that retrieves real fixture versions of `AGENTS.md` and `README.md`, both containing nested Markdown fences, and verifies byte-for-byte preservation inside the multipart sections.

## Documentation

Document:

- the invocation-tax problem Yoink addresses
- the JSON plan format
- stdin and file usage
- the multipart output contract
- exit-code behaviour
- the security implications of executing plans
- a concise example for agent skills

Use this one-line description:

> Yoink executes a retrieval plan and bundles the results into model-ready multipart Markdown.
```

