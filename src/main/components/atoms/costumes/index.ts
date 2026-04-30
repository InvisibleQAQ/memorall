import type { AgentCostume } from "../AgentIconCanvas";
import { vietCongCostume } from "./vietCongCostume";

export type AgentCostumeVariant = "auto" | "default" | "viet-cong";

const COSTUMES: Partial<Record<AgentCostumeVariant, AgentCostume>> = {
	"viet-cong": vietCongCostume,
};

const getTimezone = () => {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "";
	}
};

const getDaySeed = (date: Date) =>
	Number(
		`${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
			date.getDate(),
		).padStart(2, "0")}`,
	);

const resolveAutoVariant = (): AgentCostumeVariant => {
	const timezone = getTimezone();
	const hour = new Date().getHours();

	if (/Ho_Chi_Minh|Bangkok|Asia/i.test(timezone)) {
		return "viet-cong";
	}

	const seededSlot = (getDaySeed(new Date()) + hour) % 4;
	return seededSlot === 0 ? "viet-cong" : "default";
};

export const getAgentCostumeVariant = (
	variant: AgentCostumeVariant = "default",
): AgentCostumeVariant => {
	if (variant !== "auto") return variant;
	return resolveAutoVariant();
};

export const getAgentCostumeByVariant = (
	variant: AgentCostumeVariant = "default",
): AgentCostume | undefined => COSTUMES[getAgentCostumeVariant(variant)];

export { vietCongCostume };
