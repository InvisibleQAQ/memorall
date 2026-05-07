# CoAgent Feature

CoAgent is a browser-automation AI overlay that is injected into third-party web pages via the Chrome extension content script. It gives the AI the ability to observe, navigate, and interact with the active page on the user's behalf — clicking elements, typing into inputs, scrolling, and reading the DOM snapshot — while a floating UI provides real-time status feedback and user control.

## Architecture Overview

CoAgent spans three runtime contexts:

- **Background script** — stores the active session, routes `co-agent:*` command messages between the content script and the background, enforces timeouts.
- **Content script** — mounts and unmounts the React overlay tree inside a shadow DOM container; executes AI-issued commands on the live page.
- **Overlay (shadow DOM)** — a React application fully isolated from the host page's CSS, containing the dock, anchor prompt, and cursor overlay.

---

## File Map

### Protocol & Types

| Path | Role |
|---|---|
| `src/services/co-agent/co-agent-protocol.ts` | All command/response types: `CoAgentContentCommandRequest`, `CoAgentContentCommandResponse`, `CoAgentRect`, `CoAgentPoint`, and per-command payloads (`observe`, `query`, `move`, `click`, `input`, `scroll`, `get-trace`) |
| `src/services/co-agent/index.ts` | Public re-exports for the service layer |
| `src/services/flows/steps/features/co-agent-feature.ts` | Flow step definition — system prompt injected when CoAgent is active and the tool declarations given to the AI |

### Background Script

| Path | Role |
|---|---|
| `src/background/co-agent-browser-handler.ts` | Message routing: receives `co-agent:*` commands from the AI runner, forwards them to the content script via `chrome.tabs.sendMessage`, returns results. Holds the active session key in `chrome.storage.session` (`memorall.co-agent.active-session.v1`). Enforces an 8-second per-command timeout. |

### Content Script

| Path | Role |
|---|---|
| `src/content.ts` | Handles `SHOW_CO_AGENT` → `createCoAgentOverlay()` and `HIDE_CO_AGENT` → `destroyCoAgentOverlay()` Chrome runtime messages |
| `src/embedded/pages/CoAgent/overlay.tsx` | Creates a `div` with a shadow root, injects `coAgentStyles`, mounts the `CoAgentOverlay` React component |
| `src/embedded/pages/CoAgent/index.tsx` | Re-exports overlay, command handler, and trace utilities |
| `src/embedded/pages/CoAgent/content-command-handler.ts` | Executes each `co-agent:*` command against the live DOM; emits `memorall:agent-cursor` and `memorall:co-agent-status` window events |
| `src/embedded/pages/CoAgent/events.ts` | `emitCursorEvent()` and `emitCoAgentStatus()` helpers |
| `src/embedded/pages/CoAgent/constants.ts` | `COAGENT_CONTAINER_ID`, `CO_AGENT_STATUS_EVENT`, `ACTION_SETTLE_TIME_MS` (350 ms) |
| `src/embedded/pages/CoAgent/co-agent-chat.ts` | `coAgentChatService.chatStream()` — wraps `embeddedChatService.chatStream()` with the CoAgent flow config enabled and page/anchor context system messages |

### React UI Components

| Path | Role |
|---|---|
| `src/embedded/components/co-agents/CoAgentOverlay.tsx` | Root orchestrator: owns all CoAgent state, handles prompt submission, opens the full chat modal |
| `src/embedded/components/co-agents/CoAgentDock.tsx` | Floating bottom-right dock: agent icon with speech bubble, conversation button, optional unlock button |
| `src/embedded/components/co-agents/CoAgentAnchorPrompt.tsx` | `CoAgentAnchorTrigger` (42×42 px button) and `CoAgentAnchorPrompt` (340 px textarea popup) positioned near the hovered/focused element |
| `src/embedded/components/co-agents/useCoAgentContextAnchor.ts` | Detects hover (650 ms dwell), focus, text selection, and `Alt+Shift+A` shortcut; produces a `CoAgentContextAnchor` |
| `src/embedded/components/co-agents/styles.ts` | Shadow DOM CSS for dock, bubble, prompt popup, and animations |
| `src/embedded/components/co-agents/anchorStyles.ts` | Anchor trigger and prompt animation keyframes |

### Cursor

| Path | Role |
|---|---|
| `src/components/AgentCursor/AgentCursorOverlay.tsx` | Listens to `memorall:agent-cursor` events; manages spring-animated position tracking and a 2600 ms auto-hide timer; portals the cursor into the shadow DOM root |
| `src/components/AgentCursor/AgentCursorUI.tsx` | Renders two motion layers — Layer 1: `AgentCursorPointer` (arrow SVG), Layer 2: `AgentCursorBadge` (icon + message bubble) — spring-animated with a follow lag between them |

### Utilities

| Path | Role |
|---|---|
| `src/embedded/utils/co-agent/dom-utils.ts` | `buildPageSnapshot()`, `findQueryableElements()`, `assertSafeClickTarget()`, `assertSafeTextInput()`, `getPageDescription()` |
| `src/embedded/utils/co-agent/context-anchor.ts` | `createContextAnchor()`, `createSelectionAnchor()`, `refreshContextAnchor()` — builds `CoAgentContextAnchor` from hover/focus/selection |
| `src/embedded/utils/co-agent/trace.ts` | In-memory interaction trace: `recordTraceStep()`, `getCoAgentTrace()`, `formatCoAgentTracePrompt()` |
| `src/embedded/utils/co-agent/responses.ts` | Response builder helpers for command handlers |

---

## State Machine

All mutable state lives in `CoAgentOverlay`. The lifecycle is:

```
HIDDEN
  ──SHOW_CO_AGENT──► MOUNTED
                        │
           pointermove / focusin / selectionchange on page element
                        │
                        ▼
              freshAnchor set → AnchorTrigger appears near element
                        │
                 user clicks trigger (or Alt+Shift+A)
                        │
                        ▼
              anchorPromptOpen = true → AnchorPrompt textarea appears
                        │
                   user submits prompt
                        │
                        ▼
              isSubmitting = true
              chatStream() running with CoAgent flow enabled
              AI calls co-agent:move  → cursor animates to element
              AI calls co-agent:click → safe-click executed
              AI calls co-agent:input → safe-type executed
              onProgress streams response → message bubble updates
                        │
                   stream resolves
                        │
              isSubmitting = false, final message shown in bubble
                        │
           user clicks conversation button
                        │
                        ▼
              createEmbeddedChatModal() opens
              CoAgent can be toggled on/off inside the modal
                        │
           HIDE_CO_AGENT (or user disables in modal)
                        │
                        ▼
              destroyCoAgentOverlay() → shadow DOM removed
HIDDEN
```

### CoAgentOverlay State Reference

| State variable | Type | Purpose |
|---|---|---|
| `message` | `string` | Current status / streamed AI response shown in the speech bubble |
| `anchoredInputValue` | `string` | User's typed prompt in the anchor textarea |
| `collapsed` | `boolean` | Whether the dock is collapsed (icon only, no bubble) |
| `bubbleDismissed` | `boolean` | User clicked the ✕ on the bubble; hides text until next message |
| `isSubmitting` | `boolean` | `true` while `chatStream()` is in flight |
| `anchorPromptOpen` | `boolean` | Whether the anchor textarea popup is visible |
| `activeAnchor` | `CoAgentContextAnchor \| null` | The anchor used for the current/last prompt submission |
| `freshAnchor` | `CoAgentContextAnchor \| null` | Re-computed rect of `activeAnchor` each render (staleness check) |

---

## Context Anchor System

The anchor system maps user intent to a specific page element before the AI runs.

### Detection (`useCoAgentContextAnchor`)

Three signals create an anchor:

| Signal | Detail |
|---|---|
| **Hover** | `pointermove` on a meaningful element (not `body`/`html`/`script`) with a 650 ms dwell timer. Cancelled if pointer leaves the element. |
| **Focus** | `focusin` on any focusable element immediately creates an anchor. |
| **Selection** | `selectionchange` when `selectedText.length > 0` creates a selection anchor. |
| **Shortcut** | `Alt+Shift+A` bypasses detection and directly opens the prompt. |

### Anchor Object (`CoAgentContextAnchor`)

```ts
{
  kind: "hover" | "focus" | "selection" | "shortcut"
  selector?: string           // CSS selector usable by co-agent:query
  rect: CoAgentRect           // Bounding rect at creation time
  tagName: string
  text?: string               // innerText (trimmed, max 200 chars)
  value?: string              // input value
  ariaLabel?: string
  placeholder?: string
  href?: string
  nearbyText?: string         // text of nearby siblings (context)
  createdAt: number           // Date.now() at creation
  isStale?: boolean           // set by refreshContextAnchor()
}
```

`refreshContextAnchor()` re-queries the element and checks if its bounding rect still intersects the viewport. If not, `isStale = true` and the anchor is ignored at submission time.

### Anchor Prompt Positioning

`CoAgentAnchorPrompt` is placed right of the anchor element with a small gap, falling back to the left if there is not enough room. Viewport collision is detected to flip above/below. The prompt is 340 px wide and 1–4 rows tall.

---

## Command Execution

### Command Pipeline

```
AI tool call (co-agent:move, co-agent:click, …)
  → background co-agent-browser-handler (8 s timeout)
    → chrome.tabs.sendMessage → content script
      → content-command-handler.ts executes command
        → emits memorall:agent-cursor (cursor moves)
        → emits memorall:co-agent-status (dock bubble updates)
      → returns CoAgentContentCommandResponse
    → background resolves tool call
  → AI receives result, continues
```

### Commands

| Command | What it does |
|---|---|
| `co-agent:observe` | Builds a full `PageSnapshot` (elements, inputs, links, title, URL, scroll position) |
| `co-agent:query` | Finds all elements matching a CSS selector, returns their text / aria / bounding rects |
| `co-agent:move` | Emits cursor event to move the visible cursor to an element or point |
| `co-agent:scroll` | Scrolls the page or a specific element by a delta or to a position |
| `co-agent:click` | Clicks an element after passing `assertSafeClickTarget()` |
| `co-agent:input` | Types text into an input after passing `assertSafeTextInput()` |
| `co-agent:get-trace` | Returns the in-memory interaction trace as JSON |

### Safety Checks

**`assertSafeClickTarget()`** — blocks clicks on:
- Disabled elements
- Submit buttons
- Buttons/links matching `/(delete|remove|submit|pay|checkout|password|login|logout)/i`

**`assertSafeTextInput()`** — blocks typing into inputs matching:
- `/(password|otp|token|credit|ssn|email|phone|birth)/i`

When blocked, the response carries `blocked: true, requiresUserAction: true`. The AI is expected to pause and ask the user to act manually.

---

## Cursor System

### Event Protocol

`content-command-handler` dispatches `memorall:agent-cursor` on `window` whenever it executes a `co-agent:move` (or any command that implies a visual position):

```ts
{
  selector?: string       // CSS selector of the target element
  index?: number          // nth match if selector returns multiple
  point?: { x, y }       // absolute viewport coordinates
  rect?: { x, y, w, h }  // bounding rect (center-of-top used)
  message?: string        // label shown in the bubble
  mode?: "moveTo" | "jumpTo"  // smooth scroll vs instant
  scrollIntoView?: boolean    // default true
}
```

### AgentCursorOverlay Logic

1. On `memorall:agent-cursor`, resolves the target to a `CursorPosition` via:
   - `findCursorPoint()` — `[data-agent-cursor-point]` attribute lookup
   - `findSelectorTarget()` — `querySelectorAll(selector).item(index)`
   - `point` / `rect` → `clampPosition()`
2. For `moveTo`: calls `centerElementInScrollParents(element, "smooth")`, then tracks the element's position each animation frame for 720 ms (scroll settle time) to keep the cursor on it as the page scrolls.
3. For `jumpTo`: uses `"auto"` scroll behavior and a single `requestAnimationFrame` update.
4. Cursor position is stored in `useMotionValue` and piped through two `useSpring` chains to produce a pointer layer (fast spring) and a badge layer (slightly lagged follow spring), giving the cursor a realistic deceleration feel.
5. After 2600 ms of no new cursor events, the cursor auto-hides.

### Cursor Position Calculation

| Element type | Position used |
|---|---|
| Text input / textarea | Left edge + padding offset, vertically centered |
| Button / anchor / small control (≤ 220 × 72 px) | Center of element |
| Large element | Top-left area (18 % from left, 22 % from top) |

### AgentCursorUI Layers

```
Layer 1  z-[10000]  AgentCursorPointer  (arrow SVG)      — spring follows pointer
Layer 2  z-[9999]   AgentCursorBadge    (icon + bubble)  — spring follows Layer 1 with lag
```

Both layers use `AnimatePresence` for fade/scale on mount and unmount.

---

## Chat Integration

`coAgentChatService.chatStream()` wraps `embeddedChatService.chatStream()` with:

1. A flow config that enables the `CO_AGENT_FEATURE_STEP_NAME` step (which provides the system prompt and tool declarations to the AI).
2. Two injected system messages:
   - **Page context prompt** — current URL, page title, meta description.
   - **Anchor context prompt** (optional) — selector, tag, label, text, nearby text of the anchored element.

The chat is stateless from the dock's perspective: each prompt submission creates a fresh single-message conversation. Streamed progress is shown in the dock speech bubble via `onProgress`. The full conversation modal (`EmbeddedChat`) is a separate session with its own message history managed by `useEmbeddedChatSession`.

---

## Full Conversation Modal

Clicking the conversation button (MessageSquare icon) in the dock calls `openFullConversation()`:

```ts
createEmbeddedChatModal({
  mode: "general",
  coAgentEnabled: true,
  pageUrl, pageTitle,
  contextOptions: [viewport content snapshot (6 000 chars)],
  onCoAgentToggle: (enabled) => {
    // enabled  → send CO_AGENT_SET_ACTIVE
    // disabled → send HIDE_CO_AGENT, call onDestroy()
  },
  onClose: () => { /* modal owns its cleanup */ },
})
```

The modal mounts in its own shadow DOM (`createShadowPage`) and is independent of the dock shadow DOM. CoAgent can be toggled on/off via a header control inside the modal without affecting the dock. The modal's close button triggers `onClose` which unmounts the modal and removes its container.

---

## Interaction Trace

Every command executed by `content-command-handler` is appended to an in-memory trace array via `recordTraceStep()`. The trace is:
- Retrievable by the AI via `co-agent:get-trace`
- Formatted as JSON by `formatCoAgentTracePrompt()` for inclusion in prompts
- Not persisted — cleared when the overlay is destroyed or the page navigates

---

## Session Management

| Key | Storage | Value |
|---|---|---|
| `memorall.co-agent.active-session.v1` | `chrome.storage.session` | Active session metadata (URL, tab ID) |

The background handler reads this key to decide whether CoAgent is allowed on the current tab. On `HIDE_CO_AGENT` or when the user disables CoAgent in the modal, the key is cleared and the overlay is destroyed.

---

## CSS Isolation

The overlay runs inside a shadow DOM with its own style sheet (`coAgentStyles`). This prevents host page CSS from leaking in. All class names are prefixed with `memorall-co-agent-` or `memorall-` to avoid collisions if shadow DOM piercing occurs in edge cases.

z-index values used:

| Element | z-index |
|---|---|
| Dock root | `2147483647` (max) |
| Cursor pointer layer | `10000` |
| Cursor badge layer | `9999` |
| Anchor trigger | `2147483646` |
| Anchor prompt | `2147483646` |
