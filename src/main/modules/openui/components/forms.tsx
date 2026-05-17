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
import { Input } from "@/main/components/ui/input";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { Switch } from "@/main/components/ui/switch";
import { Textarea } from "@/main/components/ui/textarea";

const fieldId = (formName: string | undefined, name: string) =>
	`openui-${formName ?? "form"}-${name}`;

export const FormBlock = defineComponent({
	name: "FormBlock",
	description: "Container for form controls. Give each form a stable name.",
	props: z.object({
		name: z.string(),
		children: z.array(z.any()).default([]),
	}),
	component: ({ props, renderNode }) => (
		<FormNameContext.Provider value={props.name}>
			<div className="space-y-4">{renderNode(props.children)}</div>
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
			<div className="space-y-2">
				<Label htmlFor={fieldId(formName, props.name)}>{props.label}</Label>
				<Input
					id={fieldId(formName, props.name)}
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
			<div className="space-y-2">
				<Label>{props.label}</Label>
				<Select
					value={typeof value === "string" ? value : undefined}
					disabled={isStreaming}
					onValueChange={(next) =>
						setFieldValue(formName, "SelectBlock", props.name, next)
					}
				>
					<SelectTrigger>
						<SelectValue placeholder={props.placeholder ?? props.label} />
					</SelectTrigger>
					<SelectContent>
						{props.items.map((item) => (
							<SelectItem key={item.props.value} value={item.props.value}>
								{item.props.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
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
			<div className="flex items-center justify-between gap-4 rounded-lg border p-3">
				<Label htmlFor={fieldId(formName, props.name)}>{props.label}</Label>
				<Switch
					id={fieldId(formName, props.name)}
					checked={checked}
					disabled={isStreaming}
					onCheckedChange={(next) =>
						setFieldValue(formName, "SwitchBlock", props.name, next)
					}
				/>
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
			<div className="space-y-2">
				<Label htmlFor={fieldId(formName, props.name)}>{props.label}</Label>
				<Textarea
					id={fieldId(formName, props.name)}
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
