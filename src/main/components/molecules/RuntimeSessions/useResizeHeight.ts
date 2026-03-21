import { useRef, useState } from "react";
import type React from "react";

export const useResizeHeight = (initial: number, min: number, max: number) => {
	const [height, setHeight] = useState(initial);
	const [isDragging, setIsDragging] = useState(false);
	const dragStartYRef = useRef(0);
	const dragStartHeightRef = useRef(0);

	const handleMouseDown = (e: React.MouseEvent) => {
		e.preventDefault();
		setIsDragging(true);
		dragStartYRef.current = e.clientY;
		dragStartHeightRef.current = height;

		const onMouseMove = (ev: MouseEvent) => {
			const delta = ev.clientY - dragStartYRef.current;
			setHeight(
				Math.max(min, Math.min(max, dragStartHeightRef.current + delta)),
			);
		};

		const onMouseUp = () => {
			setIsDragging(false);
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	};

	return { height, isDragging, handleMouseDown };
};
