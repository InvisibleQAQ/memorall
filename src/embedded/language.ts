import {
	DEFAULT_LANGUAGE,
	LANGUAGE_STORAGE_KEY,
	type Language,
} from "@/constants/language";
import { logWarn } from "@/utils/logger";

// Centralized translation texts for all embedded components
export const EMBEDDED_TRANSLATIONS = {
	en: {
		// Chat translations
		chat: {
			defaultTopic: "Default",
			recallKnowledge: "Recall Knowledge",
			recallDescription:
				"Ask me anything about your saved knowledge and I'll help you recall relevant information.",
			context: "Context",
			closeChat: "Close chat?",
			closeConfirmation:
				"You have unsaved messages or input. Are you sure you want to close?",
			cancel: "Cancel",
			closeAnyway: "Close anyway",
			contextFromPage: "Context from page:",
			tellMeAboutTopics: "Tell me about topics related to:",
			whatDoYouKnow: "What do you know about:",
			errorMessage:
				"Sorry, I encountered an error while processing your request. Please try again.",
			authRequired: "Authentication Required",
			authRequiredDescription:
				"Your model requires authentication. Please open the main app to enter your passkey.",
			openMainApp: "Open Main App",
			noModelConfig: "No Model Configured",
			noModelConfigDescription:
				"No AI model is configured. Please open the main app to set up a model.",
			configureModel: "Configure Model",
		},
		// Topic selector translations
		topicSelector: {
			loading: "Loading...",
			chooseATopic: "Choose a topic...",
			savedToTopic: "Saved to Topic",
			contentSaved: "Content saved to",
		},
		// Input translations
		input: {
			noModelAvailable: "No model available...",
			typeMessage: "Type your message...",
			clearChat: "Clear chat",
			noTopics: "No topics",
			loadingTopics: "Loading topics...",
			allTopics: "All Topics",
			selectTopic: "Select Topic",
			modeGeneral: "Chat",
			modeKnowledge: "Knowledge",
			selectMode: "Select chat mode",
		},
		// Context section translations
		contextSection: {
			selectContext: "Select context:",
			availableContexts: "Available contexts",
			attachedContexts: "Attached to next prompt",
			clearAll: "Clear all",
			attach: "Attach",
			preview: "Preview",
			closePreview: "Close",
			imageAttached: "Image attached",
			imagePreview: "Image preview",
			saveFolder: "Folder",
			saveFileName: "File name",
			saveToDocuments: "Save to documents",
			savingToDocuments: "Saving...",
			removeAttachment: "Remove attachment",
			smartSelect: "Smart Select",
			smartSelectInstruction:
				"Hover the page, click an element, then choose Text, Clean HTML, or HTML. Press ESC to cancel.",
			smartSelectCancel: "Cancel",
			smartSelectChooseFormat: "Choose what to attach",
			smartSelectText: "Text",
			smartSelectCleanHtml: "Clean HTML",
			smartSelectHtml: "HTML",
			hideContextSection: "Hide context section",
			showContextSection: "Show context section",
			sendWithContext: "Send with context",
		},
		// Message control translations
		messageControl: {
			reasoning: "💭 Reasoning",
			sources: "🔗 Sources",
			stop: "Stop",
			send: "Send",
			recall: "Recall",
			noModel: "No model",
			openFullVersion: "Open full version",
			close: "Close",
		},
	},
	vn: {
		// Chat translations
		chat: {
			defaultTopic: "Mặc định",
			recallKnowledge: "Gợi nhớ kiến thức",
			recallDescription:
				"Hỏi tôi bất cứ điều gì về kiến thức đã lưu và tôi sẽ giúp bạn gợi nhớ thông tin liên quan.",
			context: "Ngữ cảnh",
			closeChat: "Đóng cuộc trò chuyện?",
			closeConfirmation:
				"Bạn có tin nhắn hoặc đầu vào chưa lưu. Bạn có chắc chắn muốn đóng không?",
			cancel: "Hủy",
			closeAnyway: "Vẫn đóng",
			contextFromPage: "Ngữ cảnh từ trang:",
			tellMeAboutTopics: "Hãy nói cho tôi biết về các chủ đề liên quan đến:",
			whatDoYouKnow: "Bạn biết gì về:",
			errorMessage:
				"Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.",
			authRequired: "Yêu cầu xác thực",
			authRequiredDescription:
				"Mô hình của bạn yêu cầu xác thực. Vui lòng mở ứng dụng chính để nhập mật khẩu.",
			openMainApp: "Mở ứng dụng chính",
			noModelConfig: "Chưa cấu hình mô hình",
			noModelConfigDescription:
				"Chưa có mô hình AI nào được cấu hình. Vui lòng mở ứng dụng chính để thiết lập mô hình.",
			configureModel: "Cấu hình mô hình",
		},
		// Topic selector translations
		topicSelector: {
			loading: "Đang tải...",
			chooseATopic: "Chọn một chủ đề...",
			savedToTopic: "Đã lưu vào chủ đề",
			contentSaved: "Nội dung đã được lưu vào",
		},
		// Input translations
		input: {
			noModelAvailable: "Không có mô hình khả dụng...",
			typeMessage: "Nhập tin nhắn của bạn...",
			clearChat: "Xóa cuộc trò chuyện",
			noTopics: "Không có chủ đề",
			loadingTopics: "Đang tải chủ đề...",
			allTopics: "Tất cả chủ đề",
			selectTopic: "Chọn chủ đề",
			modeGeneral: "Trò chuyện",
			modeKnowledge: "Kiến thức",
			selectMode: "Chọn chế độ trò chuyện",
		},
		// Context section translations
		contextSection: {
			selectContext: "Chọn ngữ cảnh:",
			availableContexts: "Nguồn ngữ cảnh",
			attachedContexts: "Đính kèm cho tin nhắn kế tiếp",
			clearAll: "Xóa tất cả",
			attach: "Đính kèm",
			preview: "Xem trước",
			closePreview: "Đóng",
			imageAttached: "Đã đính kèm hình ảnh",
			imagePreview: "Xem trước hình ảnh",
			saveFolder: "Thư mục",
			saveFileName: "Tên tệp",
			saveToDocuments: "Lưu vào tài liệu",
			savingToDocuments: "Đang lưu...",
			removeAttachment: "Gỡ đính kèm",
			smartSelect: "Chọn thông minh",
			smartSelectInstruction:
				"Di chuột trên trang, nhấp vào một phần tử, rồi chọn Text, Clean HTML hoặc HTML. Nhấn ESC để hủy.",
			smartSelectCancel: "Hủy",
			smartSelectChooseFormat: "Chọn nội dung cần đính kèm",
			smartSelectText: "Text",
			smartSelectCleanHtml: "Clean HTML",
			smartSelectHtml: "HTML",
			hideContextSection: "Ẩn phần ngữ cảnh",
			showContextSection: "Hiển thị phần ngữ cảnh",
			sendWithContext: "Gửi với ngữ cảnh",
		},
		// Message control translations
		messageControl: {
			reasoning: "💭 Lý luận",
			sources: "🔗 Nguồn",
			stop: "Dừng",
			send: "Gửi",
			recall: "Gợi nhớ",
			noModel: "Không có mô hình",
			openFullVersion: "Mở phiên bản đầy đủ",
			close: "Đóng",
		},
	},
};

// Helper function to load language from storage
export async function loadLanguageFromStorage(): Promise<Language> {
	try {
		const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
		const savedLanguage = result[LANGUAGE_STORAGE_KEY];

		if (savedLanguage && (savedLanguage === "en" || savedLanguage === "vn")) {
			return savedLanguage;
		}
	} catch (error) {
		logWarn("Failed to load language:", error);
	}
	return DEFAULT_LANGUAGE;
}
