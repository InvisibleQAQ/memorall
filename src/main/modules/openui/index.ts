import { createLibrary } from "@openuidev/react-lang";
import { chartComponents } from "./components/charts";
import { contentComponents } from "./components/content";
import { formComponents } from "./components/forms";
import { interactiveComponents } from "./components/interactive";
import { knowledgeComponents } from "./components/knowledge";

export const componentLibrary = createLibrary({
	root: "CardBlock",
	components: [
		...contentComponents,
		...chartComponents,
		...interactiveComponents,
		...formComponents,
		...knowledgeComponents,
	],
	componentGroups: [
		{
			name: "Content",
			components: contentComponents.map((component) => component.name),
		},
		{
			name: "Charts and tables",
			components: chartComponents.map((component) => component.name),
		},
		{
			name: "Interactive",
			components: interactiveComponents.map((component) => component.name),
		},
		{
			name: "Forms",
			components: formComponents.map((component) => component.name),
		},
		{
			name: "Knowledge",
			components: knowledgeComponents.map((component) => component.name),
		},
	],
});

export type MemorallOpenUIComponentLibrary = typeof componentLibrary;
