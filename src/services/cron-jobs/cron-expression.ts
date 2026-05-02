const FIELD_RANGES = [
	{ name: "minute", min: 0, max: 59 },
	{ name: "hour", min: 0, max: 23 },
	{ name: "day of month", min: 1, max: 31 },
	{ name: "month", min: 1, max: 12 },
	{ name: "day of week", min: 0, max: 7 },
] as const;

type CronFieldSet = Set<number>;

export interface CronValidationResult {
	valid: boolean;
	error?: string;
}

export const getLocalTimezone = (): string =>
	Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const parseInteger = (value: string, fieldName: string): number => {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${fieldName} must contain numeric values`);
	}
	return Number(value);
};

const addRange = (
	values: CronFieldSet,
	start: number,
	end: number,
	step: number,
	min: number,
	max: number,
	fieldName: string,
): void => {
	if (step < 1) {
		throw new Error(`${fieldName} step must be greater than 0`);
	}
	if (start < min || end > max || start > end) {
		throw new Error(`${fieldName} value must be between ${min} and ${max}`);
	}
	for (let value = start; value <= end; value += step) {
		values.add(fieldName === "day of week" && value === 7 ? 0 : value);
	}
};

const parseField = (
	rawField: string,
	range: (typeof FIELD_RANGES)[number],
): CronFieldSet => {
	const values = new Set<number>();
	const parts = rawField.split(",");
	if (parts.some((part) => part.trim() === "")) {
		throw new Error(`${range.name} field has an empty segment`);
	}

	for (const rawPart of parts) {
		const [base, rawStep] = rawPart.trim().split("/");
		if (rawPart.split("/").length > 2) {
			throw new Error(`${range.name} field has an invalid step`);
		}
		const step = rawStep === undefined ? 1 : parseInteger(rawStep, range.name);

		if (base === "*") {
			addRange(
				values,
				range.min,
				range.max,
				step,
				range.min,
				range.max,
				range.name,
			);
			continue;
		}

		if (base.includes("-")) {
			const [rawStart, rawEnd] = base.split("-");
			const start = parseInteger(rawStart, range.name);
			const end = parseInteger(rawEnd, range.name);
			addRange(values, start, end, step, range.min, range.max, range.name);
			continue;
		}

		const value = parseInteger(base, range.name);
		addRange(values, value, value, step, range.min, range.max, range.name);
	}

	return values;
};

export const parseCronExpression = (expression: string): CronFieldSet[] => {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 5) {
		throw new Error("Cron expression must use 5 fields");
	}
	return fields.map((field, index) => parseField(field, FIELD_RANGES[index]));
};

export const validateCronExpression = (
	expression: string,
): CronValidationResult => {
	try {
		parseCronExpression(expression);
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Invalid cron expression",
		};
	}
};

const cronMatches = (date: Date, fields: CronFieldSet[]): boolean => {
	const values = [
		date.getMinutes(),
		date.getHours(),
		date.getDate(),
		date.getMonth() + 1,
		date.getDay(),
	];
	return values.every((value, index) => fields[index].has(value));
};

const ceilToNextMinute = (date: Date): Date => {
	const next = new Date(date);
	next.setSeconds(0, 0);
	next.setMinutes(next.getMinutes() + 1);
	return next;
};

export const getNextCronRunAt = (
	expression: string,
	from: Date = new Date(),
): Date => {
	const fields = parseCronExpression(expression);
	const candidate = ceilToNextMinute(from);
	const maxMinutes = 60 * 24 * 366 * 5;

	for (let checked = 0; checked < maxMinutes; checked += 1) {
		if (cronMatches(candidate, fields)) {
			return new Date(candidate);
		}
		candidate.setMinutes(candidate.getMinutes() + 1);
	}

	throw new Error("Cron expression has no matching time in the next 5 years");
};

export const buildDailyCronExpression = (time: string): string => {
	const [hourText, minuteText] = time.split(":");
	const hour = Number(hourText);
	const minute = Number(minuteText);
	if (
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59
	) {
		throw new Error("Time must be HH:mm");
	}
	return `${minute} ${hour} * * *`;
};

export const buildWeeklyCronExpression = (
	time: string,
	dayOfWeek: number,
): string => {
	const daily = buildDailyCronExpression(time).split(" ");
	if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
		throw new Error("Day of week must be 0-6");
	}
	daily[4] = String(dayOfWeek);
	return daily.join(" ");
};
