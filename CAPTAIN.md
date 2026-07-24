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

## Upstream Note

- The `tests:all` `.env` sourcing issue is package-script tooling, not product work or a QM-owned asset change. A cancelled QM dispatch was wrong because Captain conflated that script defect with the separate pipe-closure verification blocker. Keep Captain-owned assets and package-script decisions on Captain's side; dispatch QM only for verification support.

- **From the Shipshape shakedown golden run (2026-07-24), an 84-leg control-armed eval of a
  "route all retrieval through Yoink" doctrine candidate across 13 OpenRouter models.** Two
  weaker/slower models (`minimax-m2.7`, `moonshotai/kimi-k2.7-code`) FAILED their task purely on
  Yoink bundle MECHANICS eating their whole turn budget — not comprehension; they grok Yoink and
  adopt it. Two concrete asks, both real:
  1. **Per-command truncation, not whole-bundle.** One flooding command (e.g. `find .` reaching
     into `node_modules`) blows the ~50KB cap and truncates the ENTIRE bundle, silently dropping
     the useful parts (git status, dir listings) that came after it — the agent can't tell what it
     lost and refetches everything. Bound each command's part independently, and surface WHICH
     command overflowed so the caller fixes that one command instead of the whole plan. This is
     the highest-value item: it turns a silent, budget-eating failure into a local, fixable one.
  2. **Clearer plan-parse errors.** JSON-in-heredoc breaks on shell-escape-heavy commands (`find`
     predicates with `\(`, nested quotes) — the model gets a bare parse error and burns turns
     guessing. Point the error at the offending command. The skill could also show JSON-safe
     patterns (`git ls-files` over raw `find`, simple globs, no shell-metachar predicates) and warn
     that escapes break the plan. (Shipshape's own opening-batch example is being hardened the same
     way on its side, since models reproduce the example literally.)
  Impact: weak models spend their run fighting the bundle instead of working; strong models
  (deepseek-v4-pro, kimi-k3, qwen3.7) absorb it fine — so it reads as a robustness gap that costs
  Yoink the long tail of models. Full data: shipshape-shakedown `data/eval-golden-*`, CAPTAIN.md.
