import React from "react";
import { ChevronDown, ChevronRight, Loader2, Search, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import { RECOMMENDATION_TRANSFORMER_MODELS } from "@/constants/transformer";

interface TransformerTabProps {
	model: string;
	setModel: (model: string) => void;
	loading: boolean;
	ready: boolean;
	onLoadAdvancedModel: () => Promise<void>;
	onUnloadModel: () => Promise<void>;
	quickDownloads: React.ReactNode;
}

interface HuggingFaceModel {
	id: string;
	downloads?: number;
}

const cleanTransformerName = (modelId: string) =>
	modelId
		.replace("onnx-community/", "")
		.replace("-ONNX", "")
		.replace("-Instruct", "");

const isHuggingFaceModel = (value: unknown): value is HuggingFaceModel => {
	if (typeof value !== "object" || value === null) return false;
	return "id" in value && typeof value.id === "string";
};

export const TransformerTab: React.FC<TransformerTabProps> = ({
	model,
	setModel,
	loading,
	ready,
	onLoadAdvancedModel,
	onUnloadModel,
	quickDownloads,
}) => {
	const { t } = useTranslation("llm");
	const [showAdvantages, setShowAdvantages] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");
	const [searchResults, setSearchResults] = React.useState<HuggingFaceModel[]>(
		[],
	);
	const [searchState, setSearchState] = React.useState<
		"idle" | "loading" | "error"
	>("idle");

	const searchHuggingFace = async () => {
		const query = searchQuery.trim();
		if (!query) return;
		setSearchState("loading");
		try {
			const url = new URL("https://huggingface.co/api/models");
			url.searchParams.set("search", query);
			url.searchParams.set("filter", "onnx");
			url.searchParams.set("sort", "downloads");
			url.searchParams.set("limit", "10");
			const response = await fetch(url.toString());
			if (!response.ok) {
				throw new Error(`HuggingFace returned ${response.status}`);
			}
			const data = (await response.json()) as unknown;
			if (!Array.isArray(data)) {
				throw new Error("Unexpected HuggingFace response");
			}
			setSearchResults(data.filter(isHuggingFaceModel));
			setSearchState("idle");
		} catch {
			setSearchState("error");
		}
	};

	return (
		<div className="space-y-4">
			<section className="rounded-lg border bg-muted/20">
				<button
					type="button"
					className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium"
					onClick={() => setShowAdvantages((value) => !value)}
				>
					{showAdvantages ? (
						<ChevronDown className="h-4 w-4" />
					) : (
						<ChevronRight className="h-4 w-4" />
					)}
					<Zap className="h-4 w-4 text-primary" />
					Transformer advantages
				</button>
				{showAdvantages && (
					<ul className="space-y-1 px-4 pb-3 text-xs text-muted-foreground">
						<li>ONNX format - optimized for fast inference</li>
						<li>Runs on WebGPU or WASM fallback automatically</li>
						<li>Smallest memory footprint of local runners</li>
						<li>Models from HuggingFace onnx-community namespace</li>
					</ul>
				)}
			</section>

			<section className="space-y-3">
				<div className="text-sm font-semibold">Quick download</div>
				{quickDownloads}
			</section>

			<section className="space-y-3">
				<div className="text-sm font-semibold">Recommended models</div>
				<div className="grid gap-2">
					{RECOMMENDATION_TRANSFORMER_MODELS.map((modelId) => (
						<div
							key={modelId}
							className={`flex items-center justify-between rounded-lg border p-3 ${
								model === modelId ? "border-primary bg-primary/5" : ""
							}`}
						>
							<div className="min-w-0">
								<div className="truncate text-sm font-medium">
									{cleanTransformerName(modelId)}
								</div>
								<div className="truncate text-xs text-muted-foreground">
									{modelId}
								</div>
							</div>
							<Button
								type="button"
								size="sm"
								variant={model === modelId ? "secondary" : "outline"}
								onClick={() => setModel(modelId)}
								disabled={loading}
							>
								Load
							</Button>
						</div>
					))}
				</div>
			</section>

			<section className="space-y-3 rounded-lg border p-3">
				<div className="text-sm font-semibold">HuggingFace search</div>
				<div className="flex gap-2">
					<Input
						value={searchQuery}
						onChange={(event) => setSearchQuery(event.target.value)}
						placeholder="Search HuggingFace ONNX models..."
						disabled={searchState === "loading"}
					/>
					<Button
						type="button"
						variant="outline"
						onClick={searchHuggingFace}
						disabled={searchState === "loading" || !searchQuery.trim()}
					>
						{searchState === "loading" ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Search className="h-4 w-4" />
						)}
						Search
					</Button>
				</div>
				{searchState === "error" && (
					<div className="flex items-center justify-between rounded border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
						<span>Could not reach HuggingFace</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={searchHuggingFace}
						>
							Retry
						</Button>
					</div>
				)}
				{searchResults.length > 0 && (
					<div className="grid gap-2">
						{searchResults.map((result) => (
							<div
								key={result.id}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium">
										{result.id}
									</div>
									<div className="text-xs text-muted-foreground">
										{(result.downloads ?? 0).toLocaleString()} downloads
									</div>
								</div>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => setModel(result.id)}
								>
									Load
								</Button>
							</div>
						))}
					</div>
				)}
			</section>

			{model && (
				<section className="rounded-lg border bg-muted/10 p-3">
					<div className="mb-1 text-xs font-medium">
						{t("transformer.selectedModel")}
					</div>
					<div className="break-all text-xs text-muted-foreground">{model}</div>
				</section>
			)}

			<div className="flex gap-2">
				<Button
					onClick={onLoadAdvancedModel}
					disabled={loading || ready || !model}
				>
					{t("advanced.loadModel")}
				</Button>
				<Button
					onClick={onUnloadModel}
					variant="outline"
					disabled={loading || !ready}
				>
					{t("advanced.unload")}
				</Button>
			</div>
		</div>
	);
};
