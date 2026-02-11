// Import steps for side-effect registration
// Knowledge graph steps
import "./knowledge-grow/entity-extraction";
import "./knowledge-grow/entity-resolution";
import "./knowledge-grow/fact-extraction";
import "./knowledge-grow/fact-extraction-v2";
import "./knowledge-grow/fact-resolution";
import "./knowledge-grow/edge-enrichment";
import "./knowledge-grow/temporal-extraction";
import "./knowledge-grow/database-save";
import "./knowledge-grow/load-entities";
import "./knowledge-grow/load-facts";

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

// Feature steps
import "./features/context-smart-retrieve";
import "./features/context-quick-retrieve";
import "./features/context-llm-retrieve";
import "./features/documents-feature";
