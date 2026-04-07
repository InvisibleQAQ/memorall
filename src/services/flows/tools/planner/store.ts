export interface PlanItem {
	id: string;
	description: string;
	checked: boolean;
	notes?: string;
}

export interface Plan {
	title: string;
	items: PlanItem[];
	createdAt: string;
	updatedAt: string;
}

let currentPlan: Plan | null = null;

export const planStore = {
	get: (): Plan | null => currentPlan,
	set: (plan: Plan): void => {
		currentPlan = plan;
	},
	clear: (): void => {
		currentPlan = null;
	},
};

export function formatPlan(plan: Plan): string {
	const lines = [
		`# ${plan.title}`,
		`Created: ${plan.createdAt}  Updated: ${plan.updatedAt}`,
		"",
	];
	for (const item of plan.items) {
		const box = item.checked ? "[x]" : "[ ]";
		const notes = item.notes ? ` — ${item.notes}` : "";
		lines.push(`${item.id}. ${box} ${item.description}${notes}`);
	}
	const done = plan.items.filter((i) => i.checked).length;
	lines.push("", `Progress: ${done}/${plan.items.length} completed`);
	if (plan.items.length > 0 && done === plan.items.length) {
		lines.push("✓ ALL ITEMS COMPLETE");
	}
	return lines.join("\n");
}
