# kaizen-terminal-fix

One-line patch to `packages/backend/dist/index.js` that stops KAIZEN DIRECTIVEs from firing on terminal-status tasks (`done`, `review`, `needs_clarification`).

## Problem

`autopilotNudgeInProgressAgents()` fetches `listTasks({ status: "in_progress" })` from the DB, then iterates over results to build the nudge payload. However:

1. Tasks can be updated to a terminal status **between** the DB fetch and the nudge loop (race condition).
2. The loop never re-checks `task.status`, so tasks that are already `done`/`review`/`needs_clarification` still appear in the KAIZEN DIRECTIVE and autopilot ping messages.

This causes agents to receive repeated nudges for work they have already completed, creating confusion and wasted cycles.

## Fix

**PATCH 1** — filter terminal-status tasks before the sort/escalation pipeline:

```js
// BEFORE
const sorted = [...agentTasks].sort(compareAutopilotTaskPriority);

// AFTER
const sorted = [...agentTasks]
  .filter((t) => !["done", "review", "needs_clarification"].includes(t.status))
  .sort(compareAutopilotTaskPriority);
```

If `sorted` is empty after filtering, the existing `if (actionable.length === 0) continue;` guard already short-circuits — no message is sent.

## Apply

```bash
# From repo root
bun kaizen-terminal-fix/patch.js
```

Idempotent — safe to re-run. Exits non-zero if the target string is not found and the patch has not already been applied.

## Verification

After applying:
```bash
grep -n 'filter.*done.*review.*needs_clarification' packages/backend/dist/index.js
# Should print one line near autopilotNudgeInProgressAgents
```

Then restart the backend. Agents with only `done`/`review` tasks will no longer receive autopilot pings.
