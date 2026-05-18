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
	`openui-wf-${formName ?? "form"}-${name}`;

export const FormBlock = defineComponent({
	name: "FormBlock",
	description: "Container for form controls. Give each form a stable name.",
	props: z.object({
		name: z.string(),
		children: z.array(z.any()).default([]),
	}),
	component: ({ props, renderNode }) => (
		<FormNameContext.Provider value={props.name}>
			<div className="space-y-4 border-2 border-dashed border-foreground/40 p-4 font-mono">
				<div className="text-xs text-foreground/50">FORM: {props.name}</div>
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
			<div className="space-y-1 font-mono">
				<label
					htmlFor={fieldId(formName, props.name)}
					className="text-sm font-semibold"
				>
					{props.label}:
				</label>
				<input
					id={fieldId(formName, props.name)}
					className="w-full border border-foreground/50 bg-transparent px-2 py-1 font-mono text-sm outline-none placeholder:text-foreground/30 focus:border-foreground disabled:opacity-50"
					value={String(value)}
					placeholder={props.placeholder}
					disabled={isStreaming}
					onChange={(event) =>
						setFieldValue(
							formName,
							"InputBlock",
							props.name,
							event.target.value,
						)
					}
				/>
			</div>
		);
	},
});

export const SelectItemBlock = defineComponent({
	name: "SelectItemBlock",
	description: "Dropdown option.",
	props: z.object({
		label: z.string(),
		value: z.string(),
	}),
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
			<div className="space-y-1 font-mono">
				<label className="text-sm font-semibold">{props.label}:</label>
				<select
					className="w-full border border-foreground/50 bg-transparent px-2 py-1 font-mono text-sm outline-none focus:border-foreground disabled:opacity-50"
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
			<label className="flex cursor-pointer items-center justify-between gap-4 border border-dashed border-foreground/40 p-2 font-mono text-sm">
				<span>{props.label}</span>
				<span
					className="select-none"
					onClick={() =>
						!isStreaming &&
						setFieldValue(formName, "SwitchBlock", props.name, !checked)
					}
				>
					{checked ? "[ON ]" : "[OFF]"}
				</span>
			</label>
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
			<div className="space-y-1 font-mono">
				<label
					htmlFor={fieldId(formName, props.name)}
					className="text-sm font-semibold"
				>
					{props.label}:
				</label>
				<textarea
					id={fieldId(formName, props.name)}
					className="w-full border border-foreground/50 bg-transparent px-2 py-1 font-mono text-sm outline-none placeholder:text-foreground/30 focus:border-foreground disabled:opacity-50"
					rows={3}
					value={String(value)}
					placeholder={props.placeholder}
					disabled={isStreaming}
					onChange={(event) =>
						setFieldValue(
							formName,
							"TextareaBlock",
							props.name,
							event.target.value,
						)
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
