import React, { useState } from "react";
import { Send } from "lucide-react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { serviceManager } from "@/services";
import type {
	SandboxServerInfo,
	SandboxServerRequestResult,
} from "@/services/sandbox-container";
import { cn } from "@/lib/utils";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export const PostmanTool: React.FC<{ server: SandboxServerInfo }> = ({
	server,
}) => {
	const { t } = useTranslation();
	const [method, setMethod] = useState<HttpMethod>("GET");
	const [path, setPath] = useState("/");
	const [body, setBody] = useState("");
	const [loading, setLoading] = useState(false);
	const [response, setResponse] = useState<SandboxServerRequestResult | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	const hasBody = ["POST", "PUT", "PATCH"].includes(method);

	const handleSend = async () => {
		setLoading(true);
		setError(null);
		setResponse(null);
		try {
			const result = await serviceManager
				.getSandboxContainerService()
				.requestServer({
					port: server.port,
					path: path || "/",
					method,
					body: hasBody && body ? body : undefined,
					responseType: "auto",
				});
			setResponse(result);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	const formattedBody = (() => {
		if (!response) return "";
		if (response.responseType === "json") {
			try {
				return JSON.stringify(JSON.parse(response.body), null, 2);
			} catch {
				return response.body;
			}
		}
		return response.body;
	})();

	return (
		<div className="space-y-2 p-2">
			<div className="flex gap-1">
				<select
					value={method}
					onChange={(e) => setMethod(e.target.value as HttpMethod)}
					className="shrink-0 rounded border border-border bg-background px-1 py-1 text-xs focus:outline-none"
				>
					{HTTP_METHODS.map((m) => (
						<option key={m} value={m}>
							{m}
						</option>
					))}
				</select>
				<input
					type="text"
					value={path}
					onChange={(e) => setPath(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && void handleSend()}
					placeholder={t("sandboxPanel.pathPlaceholder")}
					className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
				/>
				<button
					type="button"
					onClick={() => void handleSend()}
					disabled={loading}
					title={t("sandboxPanel.send")}
					className="shrink-0 rounded bg-primary p-1.5 text-primary-foreground disabled:opacity-50"
				>
					<Send size={11} />
				</button>
			</div>

			{hasBody && (
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					placeholder={t("sandboxPanel.bodyPlaceholder")}
					rows={3}
					className="w-full resize-none rounded border border-border bg-background px-2 py-1 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
				/>
			)}

			{error ? (
				<div className="break-words rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
					{error}
				</div>
			) : null}

			{response ? (
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"rounded border px-1.5 py-0.5 text-[10px] font-semibold",
								response.ok
									? "border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
									: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
							)}
						>
							{response.status}
						</span>
						<span className="truncate font-mono text-[10px] text-muted-foreground">
							{response.contentType}
						</span>
					</div>
					<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[10px]">
						{formattedBody}
					</pre>
				</div>
			) : null}
		</div>
	);
};
