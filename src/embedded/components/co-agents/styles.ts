import { customStyles } from "@/embedded/styles/customStyles";

export const coAgentStyles = `${customStyles}
	:host {
		--background: 0 0% 100%;
		--foreground: 0 0% 3.9%;
		--card: 0 0% 100%;
		--card-foreground: 0 0% 3.9%;
		--primary: 0 0% 9%;
		--primary-foreground: 0 0% 98%;
		--muted: 0 0% 96.1%;
		--muted-foreground: 0 0% 45.1%;
		--accent: 0 0% 96.1%;
		--accent-foreground: 0 0% 9%;
		--border: 0 0% 89.8%;
	}
	.memorall-co-agent-root {
		all: initial;
		position: fixed;
		right: 18px;
		bottom: 18px;
		z-index: 2147483647;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
		font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
		pointer-events: none;
	}
	.memorall-co-agent-dock {
		display: flex;
		align-items: center;
		gap: 8px;
		pointer-events: auto;
	}
	.memorall-co-agent-icon {
		width: 54px;
		height: 54px;
		border: 0;
		padding: 0;
		background: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		filter: drop-shadow(0 12px 24px rgb(15 23 42 / 0.22));
		cursor: default;
		overflow: visible;
		position: relative;
	}
	.memorall-co-agent-root--collapsed .memorall-co-agent-icon {
		cursor: pointer;
	}
	.memorall-co-agent-root--collapsed .memorall-co-agent-icon:focus-visible,
	.memorall-co-agent-bubble-close:focus-visible,
	.memorall-co-agent-input button:focus-visible {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
	}
	.memorall-co-agent-icon [role="status"] {
		position: absolute;
		z-index: 2147483647;
		left: auto;
		right: -4px;
		bottom: calc(100% + 14px);
		width: max-content;
		max-width: min(460px, calc(100vw - 36px));
		transform: none;
		pointer-events: auto;
		white-space: normal;
	}
	.memorall-co-agent-icon [role="status"] > div {
		position: relative;
		display: block;
		overflow: visible;
		border: 1px solid rgb(226 232 240 / 0.92);
		border-radius: 18px;
		background: #fff;
		color: #0f172a;
		box-shadow: 0 18px 44px rgb(15 23 42 / 0.24), 0 2px 0 rgb(15 23 42 / 0.12);
		font: 600 13px/1.45 Inter, ui-sans-serif, system-ui, sans-serif;
		padding: 12px 14px;
		text-align: left;
		overflow-wrap: break-word;
		white-space: normal;
	}
	.memorall-co-agent-icon .agent-speech-bubble-tail {
		display: none !important;
	}
	.memorall-co-agent-icon .agent-speech-bubble-content {
		display: block;
		max-height: min(320px, calc(100vh - 176px));
		max-width: none;
		overflow: auto;
		white-space: normal;
		scrollbar-width: thin;
		scrollbar-color: rgb(148 163 184 / 0.8) transparent;
	}
	.memorall-co-agent-bubble-content {
		position: relative;
		min-width: 0;
		padding-right: 24px;
	}
	.memorall-co-agent-bubble-close {
		position: absolute;
		right: 0px;
		top: 0px;
		z-index: 2;
		border-radius: 999px;
		width: 28px;
		height: 28px;
		border: 0;
		background: transparent;
		color: #64748b;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		pointer-events: auto;
	}
	.memorall-co-agent-bubble-close:hover {
		background: rgb(15 23 42 / 0.14);
		color: #0f172a;
	}
	.memorall-co-agent-icon .memorall-markdown {
		color: inherit;
		font: inherit;
		line-height: inherit;
	}
	.memorall-co-agent-icon .memorall-markdown > *:first-child {
		margin-top: 0;
	}
	.memorall-co-agent-icon .memorall-markdown > *:last-child {
		margin-bottom: 0;
	}
	.memorall-co-agent-icon .memorall-markdown p {
		margin: 0 0 0.65em;
	}
	.memorall-co-agent-icon .memorall-markdown ul,
	.memorall-co-agent-icon .memorall-markdown ol {
		margin: 0.35em 0 0.7em;
		padding-left: 1.25em;
	}
	.memorall-co-agent-icon .memorall-markdown li {
		margin: 0.2em 0;
	}
	.memorall-co-agent-icon .memorall-markdown a {
		color: #2563eb;
		text-decoration: underline;
		text-underline-offset: 2px;
		pointer-events: auto;
	}
	.memorall-co-agent-icon .memorall-markdown-inline-code {
		border-radius: 5px;
		background: rgb(15 23 42 / 0.08);
		color: #0f172a;
		font: 600 0.92em/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		padding: 0.08em 0.3em;
	}
	.memorall-co-agent-icon .memorall-markdown-codeblock {
		max-width: 100%;
		overflow-x: auto;
		border-radius: 10px;
		background: #0f172a;
		color: #f8fafc;
		font: 500 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		margin: 0.55em 0;
		padding: 10px;
		white-space: pre;
	}
	.memorall-co-agent-icon .memorall-markdown-table-wrap {
		max-width: 100%;
		overflow-x: auto;
		margin: 0.55em 0;
	}
	.memorall-co-agent-icon .memorall-markdown table {
		border-collapse: collapse;
		font-size: 12px;
	}
	.memorall-co-agent-icon .memorall-markdown th,
	.memorall-co-agent-icon .memorall-markdown td {
		border: 1px solid rgb(203 213 225);
		padding: 4px 6px;
		text-align: left;
	}
	.memorall-co-agent-icon [role="status"] > div::before {
		content: "";
		position: absolute;
		left: auto;
		right: 18px;
		top: 100%;
		width: 0;
		height: 0;
		border-left: 10px solid transparent;
		border-right: 10px solid transparent;
		border-top: 12px solid #fff;
		filter: drop-shadow(2px 2px 0 rgb(15 23 42 / 0.16));
	}
	.memorall-co-agent-auth {
		border: 1px solid hsl(var(--border));
		background: hsl(var(--background) / 0.86);
		color: hsl(var(--foreground));
		box-shadow: 0 8px 22px rgb(15 23 42 / 0.14);
		backdrop-filter: blur(10px);
		cursor: pointer;
		pointer-events: auto;
	}
	.memorall-co-agent-auth {
		border-radius: 8px;
		font: 600 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
		padding: 8px 10px;
	}
	.memorall-co-agent-auth:hover {
		background: hsl(var(--accent));
	}
	.memorall-co-agent-input {
		width: min(310px, calc(100vw - 36px));
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) 34px;
		align-items: center;
		gap: 4px;
		border: 1px solid hsl(var(--border));
		border-radius: 10px;
		background: hsl(var(--background) / 0.88);
		box-shadow: 0 10px 26px rgb(15 23 42 / 0.16);
		backdrop-filter: blur(12px);
		padding: 6px;
		pointer-events: auto;
	}
	.memorall-co-agent-input input {
		min-width: 0;
		height: 32px;
		border: 0;
		outline: none;
		background: transparent;
		color: hsl(var(--foreground));
		font: 500 13px/1.2 Inter, ui-sans-serif, system-ui, sans-serif;
		padding: 0 6px;
	}
	.memorall-co-agent-input input::placeholder {
		color: hsl(var(--muted-foreground));
	}
	.memorall-co-agent-input button {
		width: 34px;
		height: 32px;
		border: 0;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.memorall-co-agent-input-collapse {
		background: transparent;
		color: hsl(var(--muted-foreground));
	}
	.memorall-co-agent-input-collapse:hover {
		background: hsl(var(--accent));
		color: hsl(var(--foreground));
	}
	.memorall-co-agent-input-send {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
	.memorall-co-agent-input button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}
	.agent-cursor-pointer-layer,
	.agent-cursor-badge-layer {
		position: fixed;
		left: 0;
		top: 0;
		z-index: 2147483647;
		pointer-events: none;
	}
	.agent-cursor-pointer-offset {
		transform: translate(-10px, -10px);
	}
	.agent-cursor-badge-offset {
		transform: translate(16px, 20px);
	}
	.agent-cursor-pointer {
		width: 25px;
		height: 27px;
		color: hsl(var(--primary));
		filter: drop-shadow(0 8px 18px rgb(0 0 0 / 0.18));
	}
	.agent-cursor-badge {
		display: inline-flex;
		align-items: flex-end;
		gap: 7px;
		max-width: min(260px, calc(100vw - 42px));
		pointer-events: none;
	}
	.agent-cursor-badge-icon {
		position: relative;
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
	}
	.agent-cursor-bubble {
		position: relative;
		max-width: 190px;
		border: 1px solid rgb(226 232 240 / 0.9);
		border-radius: 12px;
		background: rgb(255 255 255 / 0.94);
		color: #0f172a;
		box-shadow: 0 10px 26px rgb(15 23 42 / 0.18);
		backdrop-filter: blur(10px);
		font: 650 11px/1.25 Inter, ui-sans-serif, system-ui, sans-serif;
		padding: 6px 9px;
		overflow: hidden;
	}
	.agent-cursor-bubble-text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: break-word;
		white-space: normal;
	}
	.agent-cursor-static {
		color: hsl(var(--primary));
		transform: translate(-10px, -10px);
	}
	.agent-cursor-static-badge {
		margin-top: 4px;
	}
`;
