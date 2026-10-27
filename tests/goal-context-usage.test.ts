import test from "node:test";
import assert from "node:assert/strict";
import { contextUsageLine, modelBudgetLine } from "../extensions/goal-accounting.ts";
import { createGoal } from "../extensions/goal-record.ts";
import { goalPromptParts } from "../extensions/prompts/goal-prompts.ts";
import { LiveTailRetention } from "../extensions/goal-live-retention.ts";

test("context occupancy never falls back to cumulative usage or invented zero", () => {
	for (const usage of [undefined, { tokens: null, contextWindow: 200000 }, { tokens: NaN, contextWindow: 200000 }, { tokens: 10, contextWindow: 0 }]) assert.equal(contextUsageLine(usage), "Context snapshot: unavailable");
	assert.equal(contextUsageLine({ tokens: 100000, contextWindow: 250000 }), "Context snapshot: 100000/250000 tokens (40%)");
	assert.equal(contextUsageLine({ tokens: 0, contextWindow: 250000 }), "Context snapshot: 0/250000 tokens (0%)");
});

test("changing and removing budget or run limits clears historical policy", () => {
	const goal = createGoal({ objective: "Continue work", autoContinue: true, sisyphus: false });
	goal.tokenBudget = 100;
	goal.usage.tokensUsed = 20;
	const retention = new LiveTailRetention();
	const base = [{ role: "user", content: "start" }];
	retention.apply("s", base, goalPromptParts(goal, { maxAutonomousRuns: 10 }));
	delete goal.tokenBudget;
	const parts = goalPromptParts(goal, {}, { tokens: 20, contextWindow: 1000 });
	const out = retention.apply("s", [...base, { role: "assistant", content: "work" }], parts);
	assert.equal(out.transientContents.length, 2);
	assert.match(out.transientContents[0]!, /Limits: lifetime tokens=none; runs=unlimited/);
	assert.doesNotMatch(out.transientContents.join("\n"), /tokens=100|runs=10/);
	assert.match(modelBudgetLine({ tokenBudget: 1, usage: { tokensUsed: 2 } })!, /spending cap, not context capacity/);
});

test("showContextUsage: false omits the Context snapshot line without placeholders", () => {
	const goal = createGoal({ objective: "Continue work", autoContinue: true, sisyphus: false });
	const usage = { tokens: 20, contextWindow: 1000 };
	// Default (unset) and explicit true both keep the line.
	for (const settings of [undefined, {}, { showContextUsage: true }]) {
		const counters = goalPromptParts(goal, settings, usage).counters;
		assert.match(counters, /Context snapshot: 20\/1000 tokens \(2%\)/);
		assert.doesNotMatch(counters, /\n\n/);
	}
	// Explicit false drops the line entirely; remaining lines stay intact.
	const hidden = goalPromptParts(goal, { showContextUsage: false, maxAutonomousRuns: 10 }, usage).counters;
	assert.doesNotMatch(hidden, /Context snapshot/);
	assert.doesNotMatch(hidden, /\n\n/);
	assert.match(hidden, /Goal snapshot: /);
	assert.match(hidden, /Autonomous runs: 0\/10/);
	// Internal accounting is unaffected: usage arguments still flow through.
	assert.equal(contextUsageLine(usage), "Context snapshot: 20/1000 tokens (2%)");
});
