import { matchesKey } from "@earendil-works/pi-tui";
import { GOAL_DIALOG_KEYS, bindingKeys, type GoalDialogAction } from "./goal-controls.ts";
import { loadGoalSettings, formatGoalKeybinding } from "./goal-settings.ts";

/** Snapshot the dialog's controls once; the modal owns input until it closes. */
export function goalDialogControls(cwd: string) {
	const configured = loadGoalSettings(cwd).keybindings?.dialog;
	const binding = (action: GoalDialogAction) => configured?.[action] ?? GOAL_DIALOG_KEYS[action];
	return {
		matches: (data: string, action: GoalDialogAction, editing = false) => bindingKeys(binding(action)).some(key => !(editing && (key === "left" || key === "right")) && matchesKey(data, key)),
		hint: (action: GoalDialogAction) => action === "toggleAuditor" && binding(action) === "a" ? "a" : formatGoalKeybinding(binding(action)),
	};
}
