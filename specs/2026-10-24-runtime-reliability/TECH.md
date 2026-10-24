# Implementation and verification

Work on `codex/runtime-reliability-and-tool-inputs` from the released main branch.

## Run admission

Use scheduler admission state to distinguish an internally rejected checkpoint from user cancellation. Preserve that rejection across Pi's startup event order and until settlement. Denied runs must not execute goal tools, start goal accounting, pause/recover the current goal, or overwrite its saved dispatch. Reset transient admission at the proper run/session boundaries and let existing valid intent schedule after rejection. Exercise the complete SDK lifecycle, including a replacement goal, same-goal stale generations and subsequent legitimate work.

## Context transforms

Select the appropriate public context event using the host's exported SDK version, verified across the supported versions. A single compatibility helper owns registration, without learning from a first request or modifying SDK internals. Full-transcript transforms preserve system messages and their positions; old-host transforms retain their existing behavior. Test parent/delegated filtering and actual provider payloads, including prompt/tool deltas, model changes and compaction boundaries.

## Tool inputs

Normalize task progress input once at the tool boundary. Keep schema and execution consistent, reject malformed arrays/entries, permit an empty array only with valid single-task input, and require every meaningful redundant root field to match one batch entry. Keep batches ordered and atomic. Normalize only genuinely empty optional detail IDs; `-` remains a real ID. Validate through the SDK boundary and retain the existing mutation/rollback tests.

## Atomic replacement

Add a small rename helper used explicitly by atomic goal, settings and checkpoint writers. Retry only supported transient Windows errors with a short bounded synchronous schedule and an asynchronous counterpart; never unlink a destination to force success. Callers retain temporary-file cleanup and locking. Tests inject errors to cover deterministic timing and use a separate Windows process holding a file without delete sharing to prove real recovery. Keep Windows CI focused on affected storage paths rather than duplicating the entire matrix.

## Evidence and credit

Record reproducers, design decisions, setbacks and validation in MILESTONES.md. Track source PRs, authors and adapted contributions in CONTRIBUTIONS.md. Use separate commits with accurate co-author trailers for adapted contributions and explicit contributor/PR links in the final PR. Run full tests with zero skips, types/lint, context/provider and performance gates, actual CLI workflows, all supported Pi SDKs, and the focused Windows check before marking the PR ready.
