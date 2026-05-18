import React from "react";
import {
	FormNameContext,
	defineComponent,
	useFormName,
	useGetFieldValue,
	useIsStreaming,
	useSetDefaultValue,
	useSetFieldValue,
} from "@openuidev/react-lang";
import { z } from "zod";

const fieldId = (formName: string | undefined, name: string) =>
	`openui-glass-${formName ?? "form"}-${name}`;

const inputClass =
	"w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm outline-none placeholder:text-foreground/30 backdrop-blur-sm transition-colors focus:border-white/40 focus:bg-white/15 disabled:opacity-50";

export const FormBlock = defineComponent({
	name: "FormBlock",
	description: "Container for form controls. Give each form a stable name.",
	props: z.object({
		name: z.string(),
		children: z.array(z.any()).default([]),
	}),
	component: ({ props, renderNode }) => (
		<FormNameContext.Provider value={props.name}>
			<div className="space-y-4 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
				{renderNode(props.children)}
			</div>
		</FormNameContext.Provider>
	),
});

export const InputBlock = defineComponent({
	name: "InputBlock",
	description: "Text input with label.",
	props: z.object({
		name: z.string(),
		label: z.string(),
		placeholder: z.string().optional(),
		defaultValue: z.string().optional(),
	}),
	component: ({ props }) => {
		const formName = useFormName();
		const isStreaming = useIsStreaming();
		const getFieldValue = useGetFieldValue();
		const setFieldValue = useSetFieldValue();
		const value =
			getFieldValue(formName, props.name) ?? props.defaultValue ?? "";
		useSetDefaultValue({
			formName,
			componentType: "InputBlock",
			name: props.name,
			existingValue: getFieldValue(formName, props.name),
			defaultValue: props.defaultValue,
		});
		return (
			<div className="space-y-1.5">
				<label
					htmlFor={fieldId(formName, props.name)}
					className="text-sm font-medium"
				>
					{props.label}
				</label>
				<input
					id={fieldId(formName, props.name)}
					className={inputClass}
					value={String(value)}
					placeholder={props.placeholder}
					disabled={isStreaming}
					onChange={(e) =>
						setFieldValue(formName, "InputBlock", props.name, e.target.value)
					}
				/>
			</div>
		);
	},
});

export const SelectItemBlock = defineComponent({
	name: "SelectItemBlock",
	description: "Dropdown option.",
	props: z.object({ label: z.string(), value: z.string() }),
	component: () => null,
});

export const SelectBlock = defineComponent({
	name: "SelectBlock",
	description: "Dropdown selector.",
	props: z.object({
		name: z.string(),
		label: z.string(),
		placeholder: z.string().optional(),
		defaultValue: z.string().optional(),
		items: z.array(SelectItemBlock.ref),
	}),
	component: ({ props }) => {
		const formName = useFormName();
		const isStreaming = useIsStreaming();
		const getFieldValue = useGetFieldValue();
		const setFieldValue = useSetFieldValue();
		const value = getFieldValue(formName, props.name) ?? props.defaultValue;
		useSetDefaultValue({
			formName,
			componentType: "SelectBlock",
			name: props.name,
			existingValue: getFieldValue(formName, props.name),
			defaultValue: props.defaultValue,
		});
		return (
			<div className="space-y-1.5">
				<label className="text-sm font-medium">{props.label}</label>
				<select
					className={inputClass}
					value={typeof value === "string" ? value : ""}
					disabled={isStreaming}
					onChange={(e) =>
						setFieldValue(formName, "SelectBlock", props.name, e.target.value)
					}
				>
					<option value="">{props.placeholder ?? props.label}</option>
					{props.items.map((item) => (
						<option key={item.props.value} value={item.props.value}>
							{item.props.label}
						</option>
					))}
				</select>
			</div>
		);
	},
});

export const SwitchBlock = defineComponent({
	name: "SwitchBlock",
	description: "Toggle switch with label.",
	props: z.object({
		name: z.string(),
		label: z.string(),
		defaultChecked: z.boolean().default(false),
	}),
	component: ({ props }) => {
		const formName = useFormName();
		const isStreaming = useIsStreaming();
		const getFieldValue = useGetFieldValue();
		const setFieldValue = useSetFieldValue();
		const existingValue = getFieldValue(formName, props.name);
		const checked =
			typeof existingValue === "boolean" ? existingValue : props.defaultChecked;
		useSetDefaultValue({
			formName,
			componentType: "SwitchBlock",
			name: props.name,
			existingValue,
			defaultValue: props.defaultChecked,
		});
		return (
			<div className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/5 px-3 py-2 backdrop-blur-sm">
				<span className="text-sm font-medium">{props.label}</span>
				<button
					type="button"
					disabled={isStreaming}
					onClick={() =>
						!isStreaming &&
						setFieldValue(formName, "SwitchBlock", props.name, !checked)
					}
					className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-white/50" : "bg-white/15"}`}
				>
					<span
						className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
					/>
				</button>
			</div>
		);
	},
});

export const TextareaBlock = defineComponent({
	name: "TextareaBlock",
	description: "Multi-line text input with label.",
	props: z.object({
		name: z.string(),
		label: z.string(),
		placeholder: z.string().optional(),
		defaultValue: z.string().optional(),
	}),
	component: ({ props }) => {
		const formName = useFormName();
		const isStreaming = useIsStreaming();
		const getFieldValue = useGetFieldValue();
		const setFieldValue = useSetFieldValue();
		const value =
			getFieldValue(formName, props.name) ?? props.defaultValue ?? "";
		useSetDefaultValue({
			formName,
			componentType: "TextareaBlock",
			name: props.name,
			existingValue: getFieldValue(formName, props.name),
			defaultValue: props.defaultValue,
		});
		return (
			<div className="space-y-1.5">
				<label
					htmlFor={fieldId(formName, props.name)}
					className="text-sm font-medium"
				>
					{props.label}
				</label>
				<textarea
					id={fieldId(formName, props.name)}
					className={inputClass}
					rows={3}
					value={String(value)}
					placeholder={props.placeholder}
					disabled={isStreaming}
					onChange={(e) =>
						setFieldValue(formName, "TextareaBlock", props.name, e.target.value)
					}
				/>
			</div>
		);
	},
});

export const formComponents = [
	FormBlock,
	InputBlock,
	SelectBlock,
	SelectItemBlock,
	SwitchBlock,
	TextareaBlock,
];
