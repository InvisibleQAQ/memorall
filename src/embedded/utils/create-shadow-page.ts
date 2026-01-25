import { createRoot } from "react-dom/client";

export const createShadowPage = ({
  customStyles
}: {
  customStyles: string
}) => {
  // Create container element
  const container = document.createElement("div");
  container.id = "memorall-embedded-chat-modal";

  // Create Shadow DOM for complete CSS isolation
  const shadowRoot = container.attachShadow({ mode: "closed" });

  // Create the actual content container inside shadow DOM
  const shadowContainer = document.createElement("div");
  shadowContainer.className = "memorall-chat-container";

  // Inject Tailwind CSS only within the Shadow DOM
  const tailwindStyle = document.createElement("link");
  tailwindStyle.rel = "stylesheet";
  tailwindStyle.href = chrome.runtime.getURL("action/index.css");

  // Add CSS custom properties for proper theming within Shadow DOM
  const customPropsStyle = document.createElement("style");
  customPropsStyle.textContent = customStyles;

  // Add styles to shadow DOM in correct order
  shadowRoot.appendChild(customPropsStyle);
  shadowRoot.appendChild(tailwindStyle);
  shadowRoot.appendChild(shadowContainer);

  // Create root and render inside shadow DOM
  const root = createRoot(shadowContainer);
  return {
    root,
    container
  }
}