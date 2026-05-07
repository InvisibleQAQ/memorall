export const coAgentAnchorStyles = `
	.memorall-co-agent-anchor-trigger {
		all: initial;
		position: fixed;
		z-index: 2147483647;
		min-width: 66px;
		height: 34px;
		border: 0;
		border-radius: 999px;
		background: #0f172a;
		color: #fff;
		box-shadow: 0 10px 26px rgb(15 23 42 / 0.22);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 0 9px;
		font: 700 12px/1 Inter, ui-sans-serif, system-ui, sans-serif;
		cursor: pointer;
		pointer-events: auto;
		animation: memorall-co-agent-pop 150ms ease-out;
		transition: transform 140ms ease;
	}
	.memorall-co-agent-anchor-trigger:hover {
		transform: translateY(-1px) scale(1.03);
	}
	.memorall-co-agent-anchor-trigger span {
		white-space: nowrap;
	}
	.memorall-co-agent-anchor-prompt {
		all: initial;
		position: fixed;
		z-index: 2147483647;
		width: min(340px, calc(100vw - 24px));
		display: grid;
		grid-template-columns: minmax(0, 1fr) 34px;
		align-items: center;
		gap: 6px;
		border: 1px solid rgb(226 232 240 / 0.94);
		border-radius: 12px;
		background: rgb(255 255 255 / 0.94);
		box-shadow: 0 16px 42px rgb(15 23 42 / 0.24);
		backdrop-filter: blur(14px);
		padding: 7px;
		pointer-events: auto;
		animation: memorall-co-agent-pop 150ms ease-out;
	}
	.memorall-co-agent-anchor-prompt textarea {
		min-width: 0;
		max-height: 92px;
		height: 32px;
		resize: none;
		border: 0;
		outline: none;
		background: transparent;
		color: #0f172a;
		font: 500 13px/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
		padding: 7px 7px 5px;
		overflow: auto;
	}
	.memorall-co-agent-anchor-prompt textarea::placeholder {
		color: #64748b;
	}
	.memorall-co-agent-anchor-prompt button {
		width: 34px;
		height: 32px;
		border: 0;
		border-radius: 8px;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.memorall-co-agent-anchor-prompt button:disabled {
		cursor: not-allowed;
		opacity: 0.42;
	}
	@keyframes memorall-co-agent-pop {
		from {
			opacity: 0;
			transform: translateY(4px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
`;
