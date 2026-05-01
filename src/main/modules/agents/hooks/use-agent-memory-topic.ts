import React from "react";
import { topicService } from "@/main/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/types";

export const useAgentMemoryTopic = (selectedPresetId: string | null) => {
	const [memoryTopic, setMemoryTopic] = React.useState<Topic | null>(null);

	React.useEffect(() => {
		let cancelled = false;

		const loadMemoryTopic = async () => {
			if (!selectedPresetId) {
				setMemoryTopic(null);
				return;
			}

			try {
				const topic = await topicService.getTopicByAgentId(selectedPresetId);
				if (!cancelled) setMemoryTopic(topic);
			} catch {
				if (!cancelled) setMemoryTopic(null);
			}
		};

		void loadMemoryTopic();
		return () => {
			cancelled = true;
		};
	}, [selectedPresetId]);

	return { memoryTopic, setMemoryTopic };
};
