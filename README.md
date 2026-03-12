<div align="center">

<img src="images/origin.png" alt="Memorall icon" width="128" />

# Memorall

### Local-first browser memory, knowledge graph, and AI workspace

Turn pages, files, and ongoing research into a searchable memory system. Memorall combines an in-page assistant, a document/workspace library, topic-scoped knowledge graphs, and agentic chat powered by browser-hosted models or optional external providers.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Extension.js](https://img.shields.io/badge/Built%20with-Extension.js-0971fe)](https://extension.js.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Local First](https://img.shields.io/badge/AI-Local--First-2f855a)](https://github.com/zrg-team/memorall)

[Quick Start](#quick-start) • [Product Surfaces](#product-surfaces) • [Architecture](#architecture-at-a-glance) • [Documentation](#documentation-map) • [GitHub](https://github.com/zrg-team/memorall)

</div>

## Why Memorall

Memorall is built for people who do serious work in tabs. Instead of treating the browser as disposable context, it turns pages, selections, documents, and workspaces into durable memory that you can search, inspect, and chat with later.

What makes the current app distinctive:

- Local-first by default. The app can run with in-browser runtimes such as Wllama, WebLLM, and Transformers, while still supporting OpenAI, OpenRouter, LM Studio, and Ollama when you want external or local server-backed models.
- More than a chat window. The shipped UI includes a document library, topic system, knowledge graph explorer, model manager, debug tools, and advanced flow/activity surfaces.
- Embedded where work happens. The content script can open a page-aware assistant, capture selected text, visible content, page HTML, and screenshots, and route saved content into a topic.
- Built for long-running work. Heavy operations are moved off the UI thread through background jobs, offscreen/runtime services, and proxy/main service pairs.
- Privacy-aware. Supabase auth is optional, the core app can run local-only, and encrypted provider credentials are restored through the app's passkey flow.

## Demo

![Memorall demo](docs/assets/demo.gif)

![Memorall screenshot](docs/assets/screenshot.jpg)

## What Users Can Do

| Area | Current capabilities |
| --- | --- |
| Chat workspace | Stream conversations, switch between chat and knowledge-aware flows, choose topics, manage agent settings, and inspect active runtime sessions for sandbox/browser tooling. |
| In-page assistant | Open an embedded chat overlay on any page, send selected text or extracted page context into chat, capture screenshots, and jump to the full app when needed. |
| Topic capture | Save selected content or full-page context into a topic from the page itself using the embedded topic selector. |
| Document library | Manage two trees: stored documents and writable workspace files. Upload/create/rename/move/delete/download files, preview PDFs/images/Excel, edit text/Markdown, and tag files with topics. |
| Knowledge conversion | Convert text, Markdown, PDF pages, and Excel sheets into topic-scoped knowledge graph data through the background job pipeline. |
| Knowledge graph | Explore nodes and edges in a D3 graph, filter by topic, search nodes, and curate graph data directly from the graph view. |
| Models and embeddings | Load local/browser models, connect remote providers, inspect current model status, and switch embedding sizes with live reload support. |
| Diagnostics | Query the database, inspect vector similarity results, browse/export logs, and monitor long-running jobs from the UI. |
| Power-user routes | Use a visual flow builder and an activity timeline that can feed captured activity sessions back into AI analysis. |

## Product Surfaces

### Main app surfaces

Routes currently wired in [`src/main/App.tsx`](./src/main/App.tsx):

- `/` - chat workspace
- `/documents` - document and workspace library
- `/knowledge-graph` - graph explorer
- `/llm` - model and provider management
- `/embeddings` - vector search/debug view
- `/database` - database inspector/query builder
- `/logs` - log viewer/export surface
- `/auth` - optional Supabase auth flow
- `/activities` - activity timeline and AI session analysis
- `/flow-builder` - visual flow authoring surface

### Embedded page surfaces

The content script and embedded pages provide two user-facing overlays:

- [`src/embedded/pages/EmbeddedChat.tsx`](./src/embedded/pages/EmbeddedChat.tsx) - a page-aware chat panel that can include selected text, visible content, full-page content, HTML structure, and captured images as context
- [`src/embedded/pages/TopicSelector.tsx`](./src/embedded/pages/TopicSelector.tsx) - a lightweight topic picker for saving page content into the knowledge system

### App shell

[`src/main/components/Layout.tsx`](./src/main/components/Layout.tsx) shows what the shared shell actually supports today:

- primary navigation for chat, documents, knowledge graph, and models
- a debug dropdown for embeddings, database, and logs
- theme switching
- English and Vietnamese UI switching
- embedding-size management
- process monitoring and standalone launch from popup mode
- optional account sign-in/sign-out

## Architecture At A Glance

```mermaid
graph TD
  PAGE["Web pages"] -->|content extraction, overlays, activity tracking| CONTENT["content.ts + src/embedded/*"]
  CONTENT -->|messages, extracted payloads, web DOM actions| BG["src/background.ts"]

  UI["Popup + standalone app<br/>src/popup.tsx / src/standalone.tsx"] -->|proxy services + jobs| JOBS["Background jobs"]
  BG -->|relay, context menus, watchdog| JOBS

  JOBS --> OFF["Offscreen/runtime processing"]
  OFF --> SM["ServiceManager"]

  SM --> DB["Database service<br/>PGlite + Drizzle"]
  SM --> EMB["Embedding service"]
  SM --> LLM["LLM service"]
  SM --> FLOWS["Flows + Flow Builder"]

  FLOWS --> TOOLS["Documents FS, workspace FS,<br/>web browser tools, Node sandbox"]
```

The runtime split in the current codebase is deliberate:

- UI surfaces use lightweight proxy services so popup and standalone stay responsive.
- heavy database, embedding, and LLM work runs in the runtime/offscreen side managed through [`src/services/service-manager.ts`](./src/services/service-manager.ts)
- cross-context execution goes through [`src/services/background-jobs`](./src/services/background-jobs)
- the MV3 background worker in [`src/background.ts`](./src/background.ts) stays thin: it registers listeners synchronously, manages context menus, relays browser work, and watches offscreen health

## Core `src/` Layout

```text
src/
  background.ts
  content.ts
  popup.tsx
  standalone.tsx
  background/          MV3 worker helpers, messaging, menus, watchdogs
  embedded/            in-page assistant, topic selector, extractors, trackers
  main/                React pages, modules, layout, auth, documents, chat UI
  services/            shared runtime services and infrastructure
    background-jobs/   cross-context job queue and handlers
    database/          PGlite, Drizzle schema, entities, migrations, RPC bridge
    embedding/         local and remote embedding implementations
    filesystem/        document/workspace virtual filesystem
    flows/             graph runtime, step/tool registry, flow builder catalog
    llm/               local/browser/API-backed model adapters
    sandbox-container/ browser-hosted execution runtime
    shared-storage/    cross-context shared state
    web-browser/       browser session and DOM automation service
```

If you want the shortest accurate mental model:

- [`src/main`](./src/main) is the user application
- [`src/embedded`](./src/embedded) is the page-integrated assistant/capture layer
- [`src/background`](./src/background) is the MV3 coordination layer
- [`src/services`](./src/services) is the real engine room

## Flow And Tooling Layer

The current source tree under [`src/services/flows`](./src/services/flows) exposes more than a single chat pipeline:

- `knowledge-rag` is the main chat-oriented graph. It can retrieve context, add feature steps, run in agent mode, and optionally add citations.
- `knowledge` is the graph-growth pipeline that extracts entities/facts from saved content and persists them into the knowledge graph.
- chat flows can be extended with feature steps for document tools, filesystem tools, browser automation, and a Node.js sandbox runtime.
- the flow builder catalog already ships services/steps for LLM, embeddings, database, retrieval, feature injection, and completion stages.

This is why the app can move cleanly between simple chat, retrieval-heavy chat, browser-aware actions, and document/workspace operations without hardcoding everything into one screen.

## Local-First AI Stack

Current model/provider support visible in the app and config:

- Browser-hosted/local runtimes: Wllama, WebLLM, Transformers
- Remote or server-backed providers: OpenAI, OpenRouter, LM Studio, Ollama
- Embedding sizes: small `384d`, medium `768d`, and large `1536d` (remote-backed)
- Storage: PGlite + Drizzle with vectors, migrations, topics, conversations, sources, nodes/edges, activities, and flow-builder state

The app works without Supabase. If Supabase is configured, the auth page becomes available for sign-in/sign-up; otherwise users can continue in local-only mode.

## Documentation Map

These are the current docs that match the codebase today:

### Architecture and services

- [Services overview](./docs/services.md)
- [Background jobs](./docs/background-jobs.md)
- [Shared storage](./docs/shared-storage.md)
- [Database service](./docs/database-service.md)
- [Embedding service](./docs/embedding-service.md)
- [LLM service](./docs/llm-service.md)
- [Flows service](./docs/flows-service.md)

### Knowledge system

- [Knowledge graph service and flow](./docs/knowledge-graph-service.md)
- [Knowledge RAG flow](./docs/knowledge-rag-service.md)
- [Smart retrieval notes](./docs/graph/smart_retrieval.md)
- [MMR usage notes](./docs/graph/mmr_usage.md)

### Auth, storage, and migration

- [Supabase docs index](./docs/supabase/index.md)
- [Supabase quickstart](./docs/supabase/quickstart.md)
- [Supabase setup](./docs/supabase/setup.md)
- [Supabase implementation](./docs/supabase/implementation.md)
- [Migration notes](./docs/migration.md)

Notes about stale docs from older README versions:

- `knowledge-pipeline.md` has been replaced by [`docs/knowledge-graph-service.md`](./docs/knowledge-graph-service.md)
- `remember-service.md` no longer exists as a standalone current doc

## Quick Start

```bash
git clone https://github.com/zrg-team/memorall.git
cd memorall
npm install
```

Then:

1. Create `.env` from `.env.example`.
2. Set `CHROME_PATH` if you want to use `npm run dev`.
3. Optionally add Supabase keys, or configure Supabase later through the app.
4. Build or run the extension.

Recommended Chrome build flow:

```bash
npm run build:chrome
```

Load the unpacked extension from `dist/chrome`.

If you want live development:

```bash
npm run dev
```

## Development Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Hot-reload development build for Chromium (`CHROME_PATH` required). |
| `npm run build` | Default production build. |
| `npm run build:chrome` | Build Chrome MV3 output in `dist/chrome`. |
| `npm run build:edge` | Build Edge MV3 output. |
| `npm run build:firefox` | Build Firefox MV3 output. |
| `npm run build:all` | Build Chrome, Edge, and Firefox outputs. |
| `npm run type-check` | Run TypeScript without emitting files. |
| `npm run lint` | Run the Extension.js lint step. |
| `npm run format` | Format `src` and `scripts` with Biome. |
| `npm run package` | Build the publish/package output. |

## Contributing

Issues and pull requests are welcome at [github.com/zrg-team/memorall](https://github.com/zrg-team/memorall).

When contributing, it helps to understand the runtime split first:

- UI and interaction work usually lives in [`src/main`](./src/main) or [`src/embedded`](./src/embedded)
- extension wiring lives in [`src/background`](./src/background), [`src/background.ts`](./src/background.ts), and [`src/content.ts`](./src/content.ts)
- anything stateful or heavy likely belongs in [`src/services`](./src/services)

## License

Memorall is licensed under the [MIT License](LICENSE).

<div align="center">

Built on Extension.js, React, TypeScript, PGlite, and browser-native AI runtimes.

</div>
