# Agent Instructions

This project uses Shipshape, a context-isolated spec-driven workflow for coding agents.

Agent opening this project: ensure Shipshape is installed, then load the `shipshape` skill (`shipshape:shipshape` under the plugin channel) and follow its routing before other work. Decide how to involve the human per your configured preferences. Before taking any action, explicitly confirm the agent's understanding of the user's instruction.

Tooling values such as stack, directories, and commands live in `RIGGING.md`.

Install with the open skills CLI, which works across most agent runtimes:

```bash
npx skills add dmytri/shipshape --skill '*'
```

If your runtime supports the open-plugin format, such as Claude Code or Cursor, install the experimental plugin build instead:

```bash
npx plugins add dmytri/shipshape
```

Update Shipshape at a voyage boundary with `npx skills update` for the skills install, or re-run `npx plugins add dmytri/shipshape` for the plugin build.
