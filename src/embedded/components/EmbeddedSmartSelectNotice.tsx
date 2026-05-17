import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";

interface EmbeddedSmartSelectNoticeProps {
	onCancel: () => void;
}

export const EmbeddedSmartSelectNotice = ({
	onCancel,
}: EmbeddedSmartSelectNoticeProps) => {
	const t = useEmbeddedTranslation("contextSection");
	return (
		<div className="memorall-smart-select-notice">
			<div className="memorall-smart-select-notice-card">
				<div className="memorall-smart-select-notice-title">
					{t("smartSelect")}
				</div>
				<p className="memorall-smart-select-notice-text">
					{t("smartSelectInstruction")}
				</p>
				<button
					type="button"
					className="memorall-smart-select-cancel-button"
					onClick={onCancel}
				>
					{t("smartSelectCancel")}
				</button>
			</div>
		</div>
	);
};
