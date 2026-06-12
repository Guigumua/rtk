#!/usr/bin/env -S npx tsx
// rtk-hook-version: 1
// RTK Trae IDE hook — rewrites shell commands to use rtk for token savings.
//
// ⚠️ Only Trae IDE is currently supported. Trae CLI is not yet supported.
//
// Works with Trae IDE's PreToolUse hook system via `.trae/hooks.json`.
// Receives JSON on stdin:  { "tool_name": "RunCommand", "tool_input": { "command": "..." } }
// Returns JSON on stdout: { "hookSpecificOutput": { "hookEventName": "PreToolUse", ... } }
//
// This is a thin delegating hook: all rewrite logic lives in `rtk rewrite`,
// which is the single source of truth (src/discover/registry.rs).
// To add or change rewrite rules, edit the Rust registry — not this file.
//
// Cross-platform: runs on any system with Node.js ≥ 18 (no jq required).
// Usage:
//   Direct:  echo '{"tool_input":{"command":"git status"}}' | npx tsx rtk-rewrite.ts
//   Via hook: configured in .trae/hooks.json with command pointing here

import { execSync } from "node:child_process";

interface TraeInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
    [key: string]: unknown;
  };
}

interface HookSpecificOutput {
  hookEventName: "PreToolUse";
  permissionDecision?: "allow";
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
}

interface TraeResponse {
  hookSpecificOutput: HookSpecificOutput;
}

function isRtkAvailable(): boolean {
  try {
    execSync("rtk --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkRtkVersion(): boolean {
  try {
    const version = execSync("rtk --version", {
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
    const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!match) return true; // can't parse, assume ok
    const [, major, minor] = match.map(Number);
    // Require >= 0.23.0
    if (major === 0 && minor < 23) {
      console.error(
        `[rtk] WARNING: rtk ${version} is too old (need >= 0.23.0). ` +
          `Upgrade: cargo install rtk`
      );
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function rewriteCommand(cmd: string): string | null {
  try {
    const result = execSync(`rtk rewrite "${cmd.replace(/"/g, '\\"')}"`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const rewritten = result.trim();
    return rewritten && rewritten !== cmd ? rewritten : null;
  } catch {
    return null;
  }
}

function main(): void {
  if (!isRtkAvailable()) {
    console.error(
      "[rtk] WARNING: rtk is not installed or not in PATH. " +
        "Hook cannot rewrite commands. " +
        "Install: https://github.com/rtk-ai/rtk#installation"
    );
    process.exit(0);
  }

  if (!checkRtkVersion()) {
    process.exit(0);
  }

  // Read stdin (Trae sends the tool invocation as JSON)
  const chunks: Buffer[] = [];
  process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf-8").trim();
    if (!raw) {
      process.exit(0);
    }

    let input: TraeInput;
    try {
      input = JSON.parse(raw);
    } catch {
      process.exit(0); // invalid JSON, pass through silently
    }

    const cmd = input.tool_input?.command;
    if (!cmd) {
      process.exit(0); // no command to rewrite
    }

    const rewritten = rewriteCommand(cmd);
    if (!rewritten) {
      process.exit(0); // no rewrite applicable
    }

    // Build updated tool_input: clone all original fields, replace command
    const updatedInput = {
      ...(input.tool_input || {}),
      command: rewritten,
    };

    const response: TraeResponse = {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: `Rewritten to: ${rewritten}`,
        updatedInput,
      },
    };

    process.stdout.write(JSON.stringify(response) + "\n");
    process.exit(0);
  });

  process.stdin.resume();
}

main();
