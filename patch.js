#!/usr/bin/env bun
/**
 * kaizen-terminal-fix/patch.js
 *
 * Filters out terminal-status tasks (done, review, needs_clarification)
 * before KAIZEN DIRECTIVE / autopilot nudge generation in
 * packages/backend/dist/index.js.
 *
 * Problem:
 *   autopilotNudgeInProgressAgents() fetches listTasks({ status: "in_progress" })
 *   but tasks may have been updated to a terminal status between the DB fetch
 *   and the nudge loop. The loop never re-checks task.status, so KAIZEN
 *   DIRECTIVEs fire on tasks that are already done/review/needs_clarification.
 *
 * Fix (PATCH 1):
 *   Inside the per-assignee loop, skip any task whose status is terminal
 *   before pushing it to the actionable/escalated pipeline.
 *
 * Usage (from repo root):
 *   bun kaizen-terminal-fix/patch.js
 *
 * Idempotent — safe to re-run.
 */

import { readFileSync, writeFileSync } from "fs";

const TARGET = "packages/backend/dist/index.js";
const TERMINAL_STATUSES = ["done", "review", "needs_clarification"];

let src = readFileSync(TARGET, "utf8");
let appliedCount = 0;

function applyPatch(name, oldStr, newStr) {
  if (!src.includes(oldStr)) {
    if (src.includes(newStr)) {
      console.log(`${name}: already applied, skipping`);
      return;
    }
    console.error(`${name}: MISS — neither old nor new string found`);
    process.exit(1);
  }
  src = src.replace(oldStr, newStr);
  appliedCount++;
  console.log(`${name}: OK`);
}

// ── PATCH 1 ─────────────────────────────────────────────────────────────────
// autopilotNudgeInProgressAgents: skip terminal-status tasks before escalation
// The loop iterates over agentTasks (fetched as in_progress) but the task
// status may have changed. Guard every task before processing it.
applyPatch(
  "PATCH 1 — skip terminal-status tasks in nudge loop",
  `    const sorted = [...agentTasks].sort(compareAutopilotTaskPriority);
    const escalated = [];
    const actionable = [];
    for (const task of sorted) {`,
  `    const sorted = [...agentTasks]
      .filter((t) => !["done", "review", "needs_clarification"].includes(t.status))
      .sort(compareAutopilotTaskPriority);
    const escalated = [];
    const actionable = [];
    for (const task of sorted) {`
);

writeFileSync(TARGET, src);
console.log(`\nAll patches applied (${appliedCount} new). Written to ${TARGET}`);
