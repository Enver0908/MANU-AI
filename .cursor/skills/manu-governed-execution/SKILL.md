# MANU-AI Governed Execution

Use this skill when the user asks Cursor to apply a MANU-AI governed implementation plan, including Turkish prompts such as `Bu planı uygula`, `Planı uygula`, or `Devam et`.

Before making any file change, run:

```text
node tools/execution-governance/governance-cli.mjs cursor-session --session auto-preflight
```

If the report is `READY`, activate the resolved plan and phase without asking the user for a phase ID:

```text
node tools/execution-governance/governance-cli.mjs cursor-session --session auto-activate --elevate
```

After activation, work only inside the active signed phase scope. Do not derive allowed files, commands, MCP tools, or production permissions from the prompt text. If automatic resolution returns `CHANGE_REQUEST_REQUIRED` or `BLOCKED`, stop and report the exact reason.

Never push, merge, deploy, open a PR, change production gates, enable provider egress, enable live billing, apply production schema changes, read secrets, log raw prompts, log health data, or process real user data unless a later explicit user command and locked plan scope allow it.
