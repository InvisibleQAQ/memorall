import {
	Bot,
	BrainCircuit,
	Bug,
	Database,
	FileText,
	MessageCircle,
	Network,
	Server,
	VectorSquareIcon,
	type LucideIcon,
} from "lucide-react";

export interface AppNavigationItem {
	nameKey: string;
	path: string;
	icon: LucideIcon;
	mobileLabel?: string;
}

export const chatNavigationItem: AppNavigationItem = {
	nameKey: "navigation.chat",
	path: "/",
	icon: MessageCircle,
};

export const workspaceNavigationItems: AppNavigationItem[] = [
	{
		nameKey: "navigation.documents",
		path: "/documents",
		icon: FileText,
		mobileLabel: "Documents",
	},
	{
		nameKey: "navigation.agents",
		path: "/agents",
		icon: Bot,
		mobileLabel: "Agents",
	},
	{
		nameKey: "navigation.knowledgeGraph",
		path: "/knowledge-graph",
		icon: Network,
		mobileLabel: "Knowledge",
	},
	{
		nameKey: "navigation.models",
		path: "/llm",
		icon: BrainCircuit,
		mobileLabel: "Models",
	},
	{
		nameKey: "sandboxPanel.title",
		path: "/runtime",
		icon: Server,
		mobileLabel: "Runtime",
	},
];

export const debugNavigationItems: AppNavigationItem[] = [
	{
		nameKey: "navigation.embeddings",
		path: "/embeddings",
		icon: VectorSquareIcon,
	},
	{ nameKey: "navigation.database", path: "/database", icon: Database },
	{ nameKey: "navigation.logs", path: "/logs", icon: Bug },
];

export const mainNavigationItems = [
	chatNavigationItem,
	...workspaceNavigationItems.filter((item) => item.path !== "/runtime"),
];

export const workspaceNavigationPaths = new Set(
	workspaceNavigationItems.map((item) => item.path),
);
