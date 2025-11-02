import React from "react";

interface FlagProps {
	className?: string;
	width?: number;
	height?: number;
}

export const VietnamFlag: React.FC<FlagProps> = ({
	className = "",
	width = 16,
	height = 12,
}) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 640 480"
		className={className}
		width={width}
		height={height}
	>
		<defs>
			<clipPath id="vn-a">
				<path fillOpacity=".7" d="M-85.3 0h682.6v512H-85.3z" />
			</clipPath>
		</defs>
		<g
			fillRule="evenodd"
			clipPath="url(#vn-a)"
			transform="translate(80)scale(.9375)"
		>
			<path fill="#da251d" d="M-128 0h768v512h-768z" />
			<path
				fill="#ff0"
				d="M349.6 381 260 314.3l-89 67.3L204 272l-89-67.7 110.1-1 34.2-109.4L294 203l110.1.1-88.5 68.4 33.9 109.6z"
			/>
		</g>
	</svg>
);

export const USFlag: React.FC<FlagProps> = ({
	className = "",
	width = 16,
	height = 12,
}) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 640 480"
		className={className}
		width={width}
		height={height}
	>
		<path fill="#bd3d44" d="M0 0h640v480H0" />
		<path
			stroke="#fff"
			strokeWidth="37"
			d="M0 55.3h640M0 129h640M0 203h640M0 277h640M0 351h640M0 425h640"
		/>
		<path fill="#192f5d" d="M0 0h364.8v258.5H0" />
		<marker id="us-a" markerHeight="30" markerWidth="30">
			<path fill="#fff" d="m14 0 9 27L0 10h28L5 27z" />
		</marker>
		<path
			fill="none"
			markerMid="url(#us-a)"
			d="m0 0 16 11h61 61 61 61 60L47 37h61 61 60 61L16 63h61 61 61 61 60L47 89h61 61 60 61L16 115h61 61 61 61 60L47 141h61 61 60 61L16 166h61 61 61 61 60L47 192h61 61 60 61L16 218h61 61 61 61 60z"
		/>
	</svg>
);
