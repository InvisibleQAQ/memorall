interface EmbeddedContextRevealButtonProps {
	label: string;
	smartSelectLabel: string;
	onClick: () => void;
	onSmartSelect: () => void;
}

export const EmbeddedContextRevealButton = ({
	label,
	smartSelectLabel,
	onClick,
	onSmartSelect,
}: EmbeddedContextRevealButtonProps) => (
	<div className="memorall-context-reveal">
		<button
			onClick={onClick}
			className="memorall-context-reveal-button"
			onKeyDown={(event) => event.stopPropagation()}
			onKeyUp={(event) => event.stopPropagation()}
			onKeyPress={(event) => event.stopPropagation()}
		>
			<svg
				className="memorall-context-reveal-icon"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M4 6h16M4 12h16M4 18h16"
				/>
			</svg>
			<span>{label}</span>
		</button>
		<button
			onClick={onSmartSelect}
			className="memorall-context-reveal-smart-button"
			onKeyDown={(event) => event.stopPropagation()}
			onKeyUp={(event) => event.stopPropagation()}
			onKeyPress={(event) => event.stopPropagation()}
		>
			<svg
				className="memorall-smart-select-icon"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.364 6.364l-2.121-2.121M8.757 8.757L6.636 6.636m11.728 0l-2.121 2.121M8.757 15.243l-2.121 2.121"
				/>
			</svg>
			<span>{smartSelectLabel}</span>
		</button>
	</div>
);
