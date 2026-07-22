> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Voyage State

Closed. Harbour review disposals, usage-asset inlining, conformance checks, and eval harness fixes shipped in `0.1.8`. Eval resample green; the "variance" was an escape-blind harness assertion, fixed.

## Outbound

`main` and tag `v0.1.8` are synced with `origin`. `@dk/yoink@0.1.8` is published. The working tree is clean.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Deferred Nits

No voyage work: no `child.on("error")` handler; `realpath(cwd)` after close can reject; `--help`/`--version` pre-scan quirks; no `--` separator; stdin concat is O(n^2).

## Eval State

- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.
