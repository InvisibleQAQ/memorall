export interface MessageActionItem {
	name: string;
	description: string;
	metadata?: Record<string, unknown>;
}

export type ActionRenderer = (
  item: MessageActionItem,
  isOpen: boolean,
) => React.ReactNode | null;
