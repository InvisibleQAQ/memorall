/**
 * Simple Excel Viewer using basic table display
 * Fallback when Univer fails
 */

import React, { useState, useEffect } from "react";
import { parseExcelFile } from "@/modules/documents/handlers/excel-extraction";
import { logError, logInfo } from "@/utils/logger";
import * as XLSX from "xlsx";

interface ExcelViewerProps {
	fileData: Uint8Array;
	fileName: string;
	className?: string;
}

export const ExcelViewer: React.FC<ExcelViewerProps> = ({
	fileData,
	fileName,
	className = "",
}) => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
	const [activeSheet, setActiveSheet] = useState<string>("");

	useEffect(() => {
		const loadExcel = async () => {
			try {
				setLoading(true);
				logInfo("Loading Excel file:", fileName);

				const wb = await parseExcelFile(fileData);
				setWorkbook(wb);
				setActiveSheet(wb.SheetNames[0] || "");

				logInfo("Excel loaded successfully, sheets:", wb.SheetNames);
			} catch (err) {
				logError("Failed to load Excel:", err);
				setError("Failed to load Excel file");
			} finally {
				setLoading(false);
			}
		};

		if (fileData) {
			loadExcel();
		}
	}, [fileData, fileName]);

	if (loading) {
		return (
			<div className={`flex items-center justify-center h-full ${className}`}>
				<div className="text-sm text-muted-foreground">
					Loading Excel file...
				</div>
			</div>
		);
	}

	if (error || !workbook) {
		return (
			<div
				className={`flex flex-col items-center justify-center h-full ${className} p-4`}
			>
				<div className="text-sm text-destructive mb-4">
					{error || "No data"}
				</div>
			</div>
		);
	}

	const renderSheet = (sheetName: string) => {
		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) return null;

		const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
		if (!jsonData.length) return <div>Empty sheet</div>;

		return (
			<div className="overflow-auto">
				<table className="min-w-full border-collapse border border-gray-300">
					<tbody>
						{(jsonData as any[][]).map((row, rowIndex) => (
							<tr key={rowIndex}>
								{row.map((cell, cellIndex) => (
									<td
										key={cellIndex}
										className="border border-gray-300 px-2 py-1 text-sm"
									>
										{cell?.toString() || ""}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	};

	return (
		<div className={`w-full h-full flex flex-col ${className}`}>
			{/* Sheet tabs */}
			{workbook.SheetNames.length > 1 && (
				<div className="flex border-b bg-gray-50 p-2 gap-2">
					{workbook.SheetNames.map((sheetName) => (
						<button
							key={sheetName}
							onClick={() => setActiveSheet(sheetName)}
							className={`px-3 py-1 text-sm rounded ${
								activeSheet === sheetName
									? "bg-blue-500 text-white"
									: "bg-white border hover:bg-gray-100"
							}`}
						>
							{sheetName}
						</button>
					))}
				</div>
			)}

			{/* Sheet content */}
			<div className="flex-1 overflow-hidden">{renderSheet(activeSheet)}</div>
		</div>
	);
};
