# Trae IDE Hooks

> ⚠️ **Only Trae IDE is currently supported.** Trae CLI is not yet supported.
>
> Part of [`hooks/`](../README.md) — see also [`src/hooks/`](../../src/hooks/README.md) for installation code

## Specifics

- **PreToolUse hook** — rewrites shell commands to use `rtk` for 60-90% token savings
- Native Rust hook (`rtk hook trae`) processes JSON from `.trae/hooks.json`, matching Trae IDE's `hookSpecificOutput` format
- TypeScript reference script (`rtk-rewrite.ts`) available as a cross-platform alternative (Node.js ≥ 18, no `jq` required)
- Trae IDE's PreToolUse JSON format:
  - **stdin:**  `{ "tool_name": "RunCommand", "tool_input": { "command": "git status" } }`
  - **stdout:** `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": { "command": "rtk git status" } } }`
- Installed to `.trae/` (project-local, workspace-scoped) by `rtk init --agent trae`

## Testing

```bash
# Test the native Rust hook (recommended)
echo '{"tool_name":"RunCommand","tool_input":{"command":"git status"}}' | rtk hook trae

# Test the TypeScript reference script
echo '{"tool_name":"RunCommand","tool_input":{"command":"git status"}}' | npx tsx hooks/trae/rtk-rewrite.ts
```
