import type {
	CoAgentContentCommandRequest,
	CoAgentContentCommandResponse,
	CoAgentElementInfo,
} from "@/services/co-agent";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import { ACTION_SETTLE_MS, DEFAULT_DOM_SUMMARY_MAX } from "./constants";
import {
	assertSafeClickTarget,
	assertSafeTextInput,
	buildSnapshot,
	createElementInfo,
	delay,
	getIndexedElement,
	getViewport,
	queryElements,
	scrollTarget,
} from "@/embedded/utils/co-agent/dom-utils";
import { emitCoAgentStatus, emitCursorEvent } from "./events";
import { createCoAgentOverlay } from "./overlay";
import {
	createBlockedResponse,
	createErrorResponse,
	createSuccessResponse,
} from "@/embedded/utils/co-agent/responses";
import {
	formatCoAgentTracePrompt,
	getCoAgentTrace,
	recordTraceStep,
} from "@/embedded/utils/co-agent/trace";

export const handleCoAgentContentCommand = async (
	request: CoAgentContentCommandRequest,
): Promise<CoAgentContentCommandResponse> => {
	if (request.type !== "co-agent:get-trace") {
		createCoAgentOverlay();
	}
	const before = getViewport();
	let response: CoAgentContentCommandResponse;
	let elementInfo: CoAgentElementInfo | undefined;
	let blocked = false;

	try {
		switch (request.type) {
			case "co-agent:observe":
				emitCoAgentStatus("Observing this page");
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({
						maxTextChars: request.maxTextChars,
						maxVisibleTextChars: request.maxVisibleTextChars,
						maxDomElements: request.maxDomElements ?? DEFAULT_DOM_SUMMARY_MAX,
					}),
				});
				break;

			case "co-agent:query":
				emitCoAgentStatus(`Checking ${request.selector}`);
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({ maxDomElements: 0 }),
					elements: queryElements(request.selector, request.maxResults),
				});
				break;

			case "co-agent:move": {
				emitCoAgentStatus(request.message || "Moving to the relevant area");
				if (request.selector) {
					const element = getIndexedElement(request.selector, request.index);
					elementInfo = createElementInfo(element, request.index ?? 0);
					emitCursorEvent({
						selector: request.selector,
						index: request.index,
						scrollIntoView: request.scrollIntoView,
						message: request.message,
						mode: request.mode,
					});
				} else {
					emitCursorEvent({
						point: request.point,
						rect: request.rect,
						message: request.message,
						mode: request.mode,
					});
				}
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({ maxDomElements: 0 }),
					element: elementInfo,
				});
				break;
			}

			case "co-agent:scroll":
				emitCoAgentStatus(request.message || "Scrolling the page");
				scrollTarget(request.selector, request.index, {
					behavior: request.behavior,
					deltaX: request.deltaX,
					deltaY: request.deltaY,
					left: request.left,
					top: request.top,
				});
				await delay(ACTION_SETTLE_MS);
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({ maxDomElements: DEFAULT_DOM_SUMMARY_MAX }),
				});
				break;

			case "co-agent:click": {
				const element = getIndexedElement(request.selector, request.index);
				elementInfo = createElementInfo(element, request.index ?? 0);
				emitCoAgentStatus(request.message || "Checking whether I can click");
				emitCursorEvent({
					selector: request.selector,
					index: request.index,
					message: request.message || "Click target",
				});
				try {
					assertSafeClickTarget(element);
				} catch (error) {
					blocked = true;
					response = createBlockedResponse(request, error, elementInfo);
					break;
				}
				(element as HTMLElement).click();
				await delay(ACTION_SETTLE_MS);
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({ maxDomElements: DEFAULT_DOM_SUMMARY_MAX }),
					element: elementInfo,
				});
				break;
			}

			case "co-agent:input": {
				const element = getIndexedElement(request.selector, request.index);
				elementInfo = createElementInfo(element, request.index ?? 0);
				emitCoAgentStatus(request.message || "Checking whether I can type");
				emitCursorEvent({
					selector: request.selector,
					index: request.index,
					message: request.message || "Input target",
				});
				try {
					assertSafeTextInput(element);
				} catch (error) {
					blocked = true;
					response = createBlockedResponse(request, error, elementInfo);
					break;
				}
				(element as HTMLElement).focus();
				if (
					element instanceof HTMLInputElement ||
					element instanceof HTMLTextAreaElement
				) {
					element.value = request.value;
					element.dispatchEvent(new Event("input", { bubbles: true }));
					element.dispatchEvent(new Event("change", { bubbles: true }));
					elementInfo = createElementInfo(element, request.index ?? 0);
				}
				await delay(ACTION_SETTLE_MS);
				response = createSuccessResponse(request, {
					snapshot: buildSnapshot({ maxDomElements: DEFAULT_DOM_SUMMARY_MAX }),
					element: elementInfo,
				});
				break;
			}

			case "co-agent:get-trace":
				response = createSuccessResponse(request, {
					trace: getCoAgentTrace(),
					note: formatCoAgentTracePrompt(),
				});
				break;
		}
	} catch (error) {
		response = createErrorResponse(request, error);
	}

	if (request.type !== "co-agent:get-trace") {
		recordTraceStep({
			request,
			before,
			after: getViewport(),
			response,
			element: elementInfo,
			blocked,
		});
	}

	if (response.success) {
		emitCoAgentStatus(response.blocked ? "User action required" : "Done");
	}
	return response;
};

export const createGetTraceRequest = (): CoAgentContentCommandRequest => ({
	source: CO_AGENT_CONTENT_COMMAND_SOURCE,
	type: "co-agent:get-trace",
});
