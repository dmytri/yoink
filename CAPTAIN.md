> STOP. Captain's notes: non-binding. Captain writes, Captain trims. Anyone else: close this file now.

# Captain Notes

Binding behaviour lives in `.feature` specs and referenced `assets/**`. History lives in git. These notes carry only what the next cycle needs.

## Current Voyage: harbour follow-ups and usage asset

Harbour review disposals executed. Live watchbill: watch1 double-signal supersede, watch2 usage-asset perturbation, watch3 plank-form conformance, watch4 eval resample.

- Perturbation planted in `usage()` (src/cli.ts). Usage copy moved to `assets/usage.txt`; build inlines it via codegen into git-ignored `src/usage-text.ts`.
- Help scenario strengthened: printed usage must equal the asset.
- Eval harness defect: per-scenario evidence dirs not namespaced (coverage/eval clobbered). QM fixes support, takes one fresh sample of the red baseline-agent scenario.
- Shipwright re-invocation riding: ts-morph/tsx removal, RIGGING refit (focused-eval variant, codegen-chained build/typecheck), provisional plank strike on `main`.
- Orphaned step defs (9, step-usage zero-match evidence) routed to Boatswain custody hygiene.

Deferred nits, no voyage work: no `child.on("error")` handler; `realpath(cwd)` after close can reject; `--help`/`--version` pre-scan quirks; no `--` separator; stdin concat is O(n^2).

## Pending Outbound

- 3 commits ahead of `origin/main`; this voyage's commits ride too.

## Conventions

- Trunk-based development: push to `origin/main` directly. No feature branches or PRs.

## Eval State

- All @eval scenarios use Pi with `-p`, `--provider openrouter`, `--model`, `--skill`, `--session-dir`, `stdio: ['ignore', 'pipe', 'pipe']` in the harness. Resolved.
