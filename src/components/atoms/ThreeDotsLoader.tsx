import React from "react";

interface ThreeDotsLoaderProps {
	className?: string;
	size?: "sm" | "md" | "lg";
}

export const ThreeDotsLoader: React.FC<ThreeDotsLoaderProps> = ({
	className = "",
	size = "md",
}) => {
	const sizeClasses = {
		sm: "w-1 h-1",
		md: "w-1.5 h-1.5",
		lg: "w-2 h-2",
	};

	const dotSize = sizeClasses[size];

	return (
		<div className={`flex items-center gap-1 ${className}`}>
			<div
				className={`${dotSize} bg-current rounded-full animate-bounce`}
				style={{ animationDelay: "0ms", animationDuration: "1s" }}
			/>
			<div
				className={`${dotSize} bg-current rounded-full animate-bounce`}
				style={{ animationDelay: "150ms", animationDuration: "1s" }}
			/>
			<div
				className={`${dotSize} bg-current rounded-full animate-bounce`}
				style={{ animationDelay: "300ms", animationDuration: "1s" }}
			/>
		</div>
	);
};
