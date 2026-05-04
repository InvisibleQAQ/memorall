import { useEffect, useState } from "react";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { logError } from "@/utils/logger";

export interface EmbeddedSelectOption {
	id: string;
	name: string;
}

export const useEmbeddedKnowledgeOptions = () => {
	const [topics, setTopics] = useState<EmbeddedSelectOption[]>([]);
	const [agentFlows, setAgentFlows] = useState<EmbeddedSelectOption[]>([]);
	const [selectedTopic, setSelectedTopic] = useState<string>("");
	const [topicsLoading, setTopicsLoading] = useState(true);
	const [selectedAgentFlowId, setSelectedAgentFlowId] =
		useState<string>("chat");

	useEffect(() => {
		const loadTopics = async () => {
			try {
				setTopicsLoading(true);
				const result = await backgroundJob.createJob(
					"get-topics",
					{},
					{ stream: false },
				);

				if (!("promise" in result)) {
					return;
				}

				const jobResult = await result.promise;
				if (
					jobResult.status === "completed" &&
					jobResult.result &&
					"topics" in jobResult.result
				) {
					const topicList = jobResult.result.topics;
					if (Array.isArray(topicList)) {
						setTopics(
							topicList.map((topic) => ({
								id: topic.id,
								name: topic.name,
							})),
						);
					}
				}
			} catch (error) {
				logError("Failed to load topics:", error);
			} finally {
				setTopicsLoading(false);
			}
		};

		void loadTopics();
	}, []);

	useEffect(() => {
		const loadPredefinedFlows = async () => {
			try {
				const result = await backgroundJob.createJob(
					"get-predefined-flows",
					{ flowKey: "knowledge-rag" },
					{ stream: false },
				);

				if (!("promise" in result)) {
					return;
				}

				const jobResult = await result.promise;
				if (
					jobResult.status === "completed" &&
					jobResult.result &&
					"flows" in jobResult.result
				) {
					const flowList = jobResult.result.flows;
					if (Array.isArray(flowList)) {
						const flows = flowList as EmbeddedSelectOption[];
						setAgentFlows(flows);
						if (flows.length > 0) {
							setSelectedAgentFlowId(flows[0].id);
						}
					}
				}
			} catch (error) {
				logError("Failed to load predefined flows:", error);
			}
		};

		void loadPredefinedFlows();
	}, []);

	return {
		topics,
		agentFlows,
		selectedTopic,
		setSelectedTopic,
		topicsLoading,
		selectedAgentFlowId,
		setSelectedAgentFlowId,
		hasTopics: topics.length > 0,
	};
};
