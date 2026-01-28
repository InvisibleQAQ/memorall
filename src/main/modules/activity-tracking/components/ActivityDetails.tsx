/**
 * Activity Details Component
 * Renders detailed activity information
 */

import React from "react";
import { useTranslation } from "react-i18next";
import type { Activity } from "@/types/activity-tracking";
import { formatTimestamp, formatDuration } from "../utils";

interface ActivityDetailsProps {
	activity: Activity;
}

interface DetailField {
	label: string;
	value: unknown;
	type?: "text" | "code" | "json";
}

export const ActivityDetails: React.FC<ActivityDetailsProps> = ({
	activity,
}) => {
	const { t } = useTranslation("activity");
	const { data } = activity;
	const fields: DetailField[] = [];

	// Common fields
	fields.push({
		label: t("details.fields.activityId"),
		value: activity.id,
		type: "code",
	});
	fields.push({
		label: t("details.fields.sessionId"),
		value: activity.sessionId,
		type: "code",
	});
	fields.push({
		label: t("details.fields.timestamp"),
		value: formatTimestamp(activity.timestamp),
	});

	// Type-specific fields
	switch (data.type) {
		case "page_visit":
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.title,
			});
			fields.push({
				label: t("details.fields.url"),
				value: data.url,
				type: "code",
			});
			if (data.favicon)
				fields.push({
					label: t("details.fields.favicon"),
					value: data.favicon,
					type: "code",
				});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			fields.push({
				label: t("details.fields.windowId"),
				value: data.windowId,
			});
			fields.push({
				label: t("details.fields.startTime"),
				value: formatTimestamp(data.startTime),
			});
			if (data.endTime)
				fields.push({
					label: t("details.fields.endTime"),
					value: formatTimestamp(data.endTime),
				});
			if (data.duration)
				fields.push({
					label: t("details.fields.duration"),
					value: formatDuration(data.duration),
				});
			if (data.referrer)
				fields.push({
					label: t("details.fields.referrer"),
					value: data.referrer,
					type: "code",
				});
			break;

		case "network_request":
			fields.push({
				label: t("details.fields.url"),
				value: data.url,
				type: "code",
			});
			fields.push({
				label: t("details.fields.method"),
				value: data.method,
			});
			fields.push({
				label: t("details.fields.requestType"),
				value: data.requestType,
			});
			if (data.statusCode)
				fields.push({
					label: t("details.fields.statusCode"),
					value: data.statusCode,
				});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			if (data.pageTitle)
				fields.push({
					label: t("details.fields.pageTitle"),
					value: data.pageTitle,
				});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			fields.push({
				label: t("details.fields.requestId"),
				value: data.requestId,
				type: "code",
			});
			if (data.initiator)
				fields.push({
					label: t("details.fields.initiator"),
					value: data.initiator,
					type: "code",
				});
			if (data.requestBodySize !== undefined) {
				fields.push({
					label: t("details.fields.requestBodySize"),
					value: `${(data.requestBodySize / 1024).toFixed(2)} KB`,
				});
				if (data.requestBodyTruncated)
					fields.push({
						label: t("details.fields.bodyTruncated"),
						value: t("details.fields.yes"),
					});
			}
			if (data.requestBody)
				fields.push({
					label: t("details.fields.requestBody"),
					value: data.requestBody,
					type: "json",
				});
			break;

		case "user_input":
			fields.push({
				label: t("details.fields.inputType"),
				value: data.inputType,
			});
			fields.push({
				label: t("details.fields.content"),
				value: data.isRedacted ? t("details.fields.redacted") : data.content,
				type: "code",
			});
			fields.push({
				label: t("details.fields.isRedacted"),
				value: data.isRedacted
					? t("details.fields.yes")
					: t("details.fields.no"),
			});
			fields.push({
				label: t("details.fields.element"),
				value: JSON.stringify(data.elementInfo, null, 2),
				type: "json",
			});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.pageTitle,
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			break;

		case "click":
			fields.push({
				label: t("details.fields.element"),
				value: JSON.stringify(data.elementInfo, null, 2),
				type: "json",
			});
			fields.push({
				label: t("details.fields.position"),
				value: `X: ${data.position.x}, Y: ${data.position.y}`,
			});
			fields.push({
				label: t("details.fields.viewport"),
				value: `${data.viewport.width} × ${data.viewport.height}`,
			});
			fields.push({
				label: t("details.fields.isRightClick"),
				value: data.isRightClick
					? t("details.fields.yes")
					: t("details.fields.no"),
			});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.pageTitle,
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			break;

		case "scroll":
			fields.push({
				label: t("details.fields.scrollPosition"),
				value: `X: ${data.scrollPosition.x}, Y: ${data.scrollPosition.y}`,
			});
			fields.push({
				label: t("details.fields.scrollDepth"),
				value: `${data.scrollDepth.toFixed(1)}%`,
			});
			fields.push({
				label: t("details.fields.pageHeight"),
				value: `${data.pageHeight}px`,
			});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.pageTitle,
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			break;

		case "navigation":
			fields.push({
				label: t("details.fields.fromUrl"),
				value: data.fromUrl || t("details.fields.direct"),
				type: "code",
			});
			fields.push({
				label: t("details.fields.toUrl"),
				value: data.toUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			if (data.transitionType)
				fields.push({
					label: t("details.fields.transitionType"),
					value: data.transitionType,
				});
			if (data.transitionQualifiers && data.transitionQualifiers.length > 0) {
				fields.push({
					label: t("details.fields.transitionQualifiers"),
					value: data.transitionQualifiers.join(", "),
				});
			}
			break;

		case "form_submit":
			fields.push({
				label: t("details.fields.form"),
				value: JSON.stringify(data.formInfo, null, 2),
				type: "json",
			});
			fields.push({
				label: t("details.fields.fieldCount"),
				value: data.fieldCount,
			});
			if (data.method)
				fields.push({
					label: t("details.fields.method"),
					value: data.method,
				});
			if (data.action)
				fields.push({
					label: t("details.fields.action"),
					value: data.action,
					type: "code",
				});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.pageTitle,
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			break;

		case "text_reading":
			fields.push({
				label: t("details.fields.viewDuration"),
				value: formatDuration(data.viewDuration),
			});
			fields.push({
				label: t("details.fields.textLength"),
				value: `${data.textLength.toLocaleString()} ${t("details.fields.characters")}`,
			});
			fields.push({
				label: t("details.fields.truncated"),
				value: data.truncated
					? t("details.fields.yes")
					: t("details.fields.no"),
			});
			fields.push({
				label: t("details.fields.scrollDepth"),
				value: `${data.scrollDepth.toFixed(1)}%`,
			});
			fields.push({
				label: t("details.fields.captureTime"),
				value: formatTimestamp(data.captureTime),
			});
			fields.push({
				label: t("details.fields.visibleText"),
				value: data.visibleText,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageUrl"),
				value: data.pageUrl,
				type: "code",
			});
			fields.push({
				label: t("details.fields.pageTitle"),
				value: data.pageTitle,
			});
			fields.push({
				label: t("details.fields.tabId"),
				value: data.tabId,
			});
			break;
	}

	return (
		<div className="space-y-3">
			{fields.map((field, idx) => (
				<div
					key={idx}
					className="grid grid-cols-3 gap-4 py-2 border-b last:border-b-0"
				>
					<div className="font-medium text-sm text-muted-foreground">
						{field.label}
					</div>
					<div className="col-span-2 text-sm">
						{field.type === "json" || field.type === "code" ? (
							<pre className="bg-muted p-2 rounded text-xs overflow-x-auto font-mono">
								{field.value as string}
							</pre>
						) : (
							<span className="break-all">{field.value as string}</span>
						)}
					</div>
				</div>
			))}
		</div>
	);
};
