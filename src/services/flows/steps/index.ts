// Import steps for side-effect registration
// Knowledge graph steps
import "./features/knowledge-grow/entity-extraction";
import "./features/knowledge-grow/entity-resolution";
import "./features/knowledge-grow/fact-extraction";
import "./features/knowledge-grow/fact-extraction-v2";
import "./features/knowledge-grow/fact-resolution";
import "./features/knowledge-grow/edge-enrichment";
import "./features/knowledge-grow/temporal-extraction";
import "./features/knowledge-grow/database-save";
import "./features/knowledge-grow/load-entities";
import "./features/knowledge-grow/load-facts";

import "./structmem/structmem-event-extraction";
import "./structmem/structmem-save-event";
import "./structmem/structmem-load-related-events";
import "./structmem/structmem-consolidation";
import "./structmem/structmem-save-consolidation";
import "./structmem/structmem-retrieve";

// RAG steps
import "./knowledge-retrieval/analyze-query";
import "./knowledge-retrieval/llm-retrieve";
import "./knowledge-retrieval/quick-retrieve";
import "./knowledge-retrieval/smart-retrieve";

import "./knowledge-retrieval/entities-facts-to-context";
import "./knowledge-retrieval/entities-facts-citation";

// Common steps
import "./common/chat-completion";
import "./common/agent-completion";
import "./common/add-system";
import "./common/add-skill-context";
import "./common/context-to-system";
import "./common/current-time";
import "./common/gpt-boost";

// Feature steps
import "./features";
