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
import "./knowledge-retrieval/context-to-system";

// Common steps
import "./common/chat-completion";
import "./common/agent-completion";
import "./common/add-system";
import "./common/add-skill-context";

// Feature steps
import "./features/context-smart-retrieve";
import "./features/context-quick-retrieve";
import "./features/context-llm-retrieve";
import "./features/fs-feature";
import "./features/documents-fs-feature";
import "./features/documents-feature";
import "./features/nodejs-sandbox-feature";
import "./features/web-feature";
import "./features/news-collection-feature";
import "./features/travel-planner-feature";
import "./features/meal-planner-feature";
import "./features/daily-briefing-feature";
import "./features/job-application-feature";
import "./features/planner-feature";
import "./features/multi-agent-feature";
import "./features/mcp-feature";
