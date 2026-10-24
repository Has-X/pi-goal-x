# Runtime reliability and tolerant tool inputs

Implement the problems raised in PRs #104, #97, #92, #91 and #94 against the current codebase. Keep the standard goal workflow, pause controls and immediate continuation defaults. These are correctness and reliability fixes, not new execution modes.

- Reject stale goal checkpoints without pausing, charging or changing a replacement goal. Completion and accounting remain bound to the run that actually did the work. Valid saved scheduling intent can proceed after the rejected run settles.
- Preserve Pi's system prompt and tool deltas on hosts with the full-transcript hook, from the first request. Keep supported older hosts working and preserve audit filtering, delegation and compaction behavior.
- Treat empty optional task IDs as omitted. Accept matching redundant single-task fields with an atomic batch, but reject contradictions and malformed batches without changing state. Empty batches may accompany a valid single-task call. Do not invent placeholder task IDs or weaken task/evidence rules.
- Recover from temporary Windows rename sharing failures without losing atomic replacement, revision checks, file permissions or cleanup. Bound synchronous delays tightly; ordinary writes and non-Windows failures keep their fast path. Demonstrate eventual success and permanent failure on an actual Windows runner.

Create one reviewed branch and concise PR. Credit the original contributors in GitHub and in the relevant commits for adapted tests, implementation and design contributions. Preserve contributor identity without pretending their PRs were merged unchanged. Leave README scope and unrelated user files alone.
