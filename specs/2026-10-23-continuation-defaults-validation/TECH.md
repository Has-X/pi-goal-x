# Technical plan and experiment protocol

## 1. Separate the independent fix

Retain #90's stale-context handling and regressions independently of scheduling
policy. The branch at `3551bcc` combines it with default backoff; the eventual
implementation must keep the former and revise the latter before merge.

## 2. Prototype alternatives without changing the shipped policy

Prepare isolated copies from `64c5ace` (original default) and `3551bcc` (current
backoff). A third copy changes only backoff activation to an explicit boolean
global/project choice defaulting false. Preserve the same SDK, model, tools,
objective and auditor wherever a comparison is paired. Save the prototype patch
and effective settings in the result record. A changed default must not be
confused with a different model or an altered task.

Prototype work is disposable and must not modify the user's real goals, settings,
sessions or credentials. Read configured model availability through the SDK; do
not copy credentials into artifacts. Use a local scripted provider for controlled
boundary cases, and a configured real model for spontaneous tool and completion
choices. Keep external calls bounded and record actual usage without claiming
zero billing from missing usage. If a provider is unavailable, report the missing
real-model evidence honestly and complete independent local checks.

## 3. Comparative evaluation

### Controlled SDK journeys

Use the actual SDK and registered commands/tools. Begin through `/goal-direct`
for deterministic execution journeys; use `/goal` and its confirmation UI in the
terminal/real-model walkthrough. The local scripted provider controls otherwise
rare run boundaries, rather than testing only a pure scheduling function.

Measure:

- Provider-request start times, count and purpose; include auditor calls separately.
- Delay between settled executions and the next actionable continuation.
- Correct artifacts and independent-audit outcome where applicable.
- User commands, dialog choices and scheduling declarations required.
- Goal status, scheduler state, effective option and used allowance at boundaries.
- Quiet periods, wake latency, duplicate markers and active-time accounting.

Run original/current/candidate for at least: ordinary tools, reasoning-only
responses, productive custom tools and repeated idle replies. Compare the same
output sequence; hold all other settings constant. Stop an unbounded original
idle loop at a harness ceiling and label the stop as a harness intervention.
The candidate's default should match the original behavior; enabling its option
should match the existing backoff only where explicitly chosen.

Exercise optional strict wait using a registered producer with real completion
events, plus user input, resume, deadline/check bounds, early/duplicate/stale
events, ownership changes and reload. Boundary fixtures may seed state, but must
be labeled separately from user-command journeys.

### Actual terminal walkthrough

Drive the installed `pi` CLI in an isolated pseudo-terminal, at normal and narrow
sizes. Record raw terminal bytes and readable screen snapshots. Type the same
slash commands and select the same dialog choices a person would. Check goal
confirmation, readable running/paused/completed state, Escape or `/goal-pause`,
`/goal-resume`, `/goal-status`, settings discoverability and cancellation.
Document visible surprises and required workarounds rather than forcing a pass.
This is an agent-operated walkthrough, not a study of representative humans.

### Real-model smoke

Give a small, independently checkable coding objective with normal wording. Let
the model choose tools and when to complete; do not tell it to emit a fixed tool
sequence. Use the real independent auditor. Record the artifact, assertions,
user choices, requests, elapsed time, errors and model/provider. A short writing
or unfamiliar-tool task probes policy sensitivity when practical. Model behavior
is nondeterministic; do not generalize one successful run to all models/users.

## 4. Production implementation after validation

If comparative results support the candidate:

1. Add `idleContinuationBackoff?: boolean` to the sparse settings layer; resolve
   missing to false, use the existing boolean normalization (including historical
   `"true"`/`"false"` strings), reject unsupported values, preserve explicit false, and support
   global/project inheritance plus override removal through existing helpers.
2. Add one row to the existing settings UI: "Slow repeated idle replies (opt-in)", off by
   default. Explain that it slows repeated responses without recognized work and
   may delay reasoning/custom tools. Do not add a creation question, new command
   or new ready argument.
   Expose the existing scope-switch action in the options list; its handler is
   currently unreachable because the menu renders no `Scope:` row. Verify global
   selection, project override and inheritance through keyboard interaction.
3. Gate streak updates, delay scheduling, claim-time checks, wait accounting and
   status text on the effective option. Disabling while paced cancels/re-evaluates
   the timer promptly; claiming rechecks both the option and all existing guards.
   Do not reset spent allowance or resume lifecycle state as a side effect.
4. Persist optional pacing metadata compatibly. An old record with `idle` data
   and no explicit opt-in loads with immediate default behavior. Treat the
   unreleased branch's metadata as non-authoritative for user preference. Turning
   the option back on starts a fresh streak at the next eligible settlement.
5. Keep strict-contract waits and provider-error recovery independent. A stock
   default execution must not depend on the work classifier. Keep the `event.input`
   correction for the Oracle and optional pacing path.
6. Update advanced usage and changelog around explicit choice; remove claims that
   default idle pacing is accepted. Preserve README scope and register the spec.

## 5. Regression gates before merge

The initial opt-out probe failed because settlement checked the flag while timer/
claim paths still read saved `idle` metadata and the UI side-effect hook only
refreshed presentation. The prototype now resolves the flag at those paths,
reconsiders scheduling on UI mutation and passes SDK plus actual terminal opt-out.
Production implementation must port and permanently verify these rules:

- Resolve the preference consistently at schedule, claim, restoration, status
  rendering and accounting; discard disabled pacing without resetting `used`.
- Re-evaluate scheduling after a UI setting mutation or an explicit settings
  refresh, so opting out does not wait until the old timer expires.
- Start a fresh pacing streak when enabled; do not revive an obsolete saved delay.
- Skip goal-content snapshots and optional pacing bookkeeping while disabled.
  If enabled during an execution, start measuring at a subsequent execution
  boundary rather than retroactively calling unobserved activity idle.

- Default: no scheduling delay across many reasoning-only responses or unfamiliar
  tools; final-task wrap-up reaches completion; no added model declarations.
- Enabled: full delay ladder/cap, durable reopen, no charge while waiting and one
  admission; visible explanation; resume/producer input stay prompt.
- Preferences: absent/false/true/invalid values, global/project false override,
  reset-to-inherited, settings changes while queued and at claim, disable/re-enable
  after reload, no run-counter renewal.
- Safety: pause/unfocus/replace/shutdown, ownership, stale/duplicate claims,
  allowance/token limits, errors, native retry/compaction and #90 regressions.
- Run typecheck, lint, unit discovery/self-check, integration/e2e suites and the
  context gate. Add a new context fixture for opted-in pacing if its prompt is
  intentionally changed; do not regenerate baselines merely to hide drift.

## 6. Follow-up feature boundaries

Optional waits without mandatory ready declarations require a distinct product
decision and producer integration tests. Inventory actual public completion APIs
before implementing an adapter; avoid generic `status/id` inference or producer
text injected as trusted instructions. A stall watchdog requires its own opt-in
semantics and false-positive study. Neither blocks an ordinary-default fix.

## 7. Decision record

Write `VALIDATION.md` with a scenario/result table, actual commands, artifact links,
timing/request data, failed attempts, evidence quality and remaining release gates.
Update `PRODUCT.md` from evidence first, then this plan and implementation log.
Mark plan/evaluation complete independently of production implementation; do not
report unimplemented settings or future integrations as shipped.
