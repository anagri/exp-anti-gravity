# DocsGPT Browser-Only Version - Product Requirements Document

## Executive Summary

This PRD outlines the development of a browser-only, client-side RAG (Retrieval-Augmented Generation) application inspired by DocsGPT. The application enables users to upload documents, create knowledge bases, and have AI-powered conversations with their documents using vector search and keyword search, all running entirely in the browser without requiring a backend server.

---

## Phase 1: Core RAG Foundation

### Objective
Establish the fundamental RAG pipeline: document ingestion, chunking, embedding, storage, and basic question-answering.

### Features

#### 1.1 Document Upload
- **Description**: Users can upload a single document (PDF, TXT, MD) through a drag-and-drop interface
- **Reference**: DocsGPT supports multiple formats including PDF, DOCX, CSV, XLSX, EPUB, MD, and more [1](#0-0) 

#### 1.2 Document Processing Pipeline
- **Description**: Automatically parse, chunk (150-1250 token chunks), and prepare documents for embedding
- **Reference**: The embedding pipeline handles document chunking and preparation [2](#0-1) 

#### 1.3 In-Browser Vector Storage
- **Description**: Generate embeddings and store in PGLite+pgvector for similarity search
- **Reference**: DocsGPT uses vectorstores with search capabilities [3](#0-2) 

#### 1.4 Basic Chat Interface
- **Description**: Simple text input for questions with streaming response display
- **Reference**: The conversation interface handles message input and display [4](#0-3) 

#### 1.5 Simple RAG Query Flow
- **Description**: User asks a question → retrieve relevant chunks → send to LLM → display answer
- **Reference**: ClassicRAG implements the retrieval logic [5](#0-4) 

### Functional Tests (Phase 1 Complete)

**Test 1.1: Document Upload Success**
```
GIVEN a user is on the home screen
WHEN they drag and drop a PDF file
THEN the file should upload successfully
AND show processing status
AND complete with a success message
```

**Test 1.2: Chunk Generation**
```
GIVEN a document has been uploaded
WHEN processing completes
THEN the document should be split into chunks
AND chunks should be stored in local vector database
AND user should see confirmation of X chunks created
```

**Test 1.3: Basic Question Answering**
```
GIVEN a document has been processed and stored
WHEN user types "What is the main topic of this document?"
THEN the system should retrieve relevant chunks
AND generate an answer using LLM
AND display the answer in the chat interface
```

**Test 1.4: Source Context Retrieval**
```
GIVEN a user asks a question
WHEN the RAG system retrieves information
THEN at least 2 relevant document chunks should be retrieved
AND these chunks should be used to augment the LLM prompt
```

**Test 1.5: Answer Streaming**
```
GIVEN a question is submitted
WHEN the LLM generates a response
THEN the answer should stream token-by-token to the UI
AND display progressively as it's generated
```

---

## Phase 2: Enhanced Conversation Experience

### Objective
Build a complete conversational interface with history, context, and source attribution.

### Features

#### 2.1 Conversation History
- **Description**: Maintain full conversation context with messages persisted in browser storage
- **Reference**: Conversations are stored and managed [6](#0-5) 

#### 2.2 Query Rephrasing with Context
- **Description**: Use conversation history to rephrase follow-up questions for better retrieval
- **Reference**: ClassicRAG rephrases queries with conversation context [7](#0-6) 

#### 2.3 Source Citations
- **Description**: Display source documents and specific chunks used to generate each answer
- **Reference**: Retrieved documents include title, text, source, and filename metadata [8](#0-7) 

#### 2.4 Conversation Management
- **Description**: Create new conversations, switch between conversations, view history
- **Reference**: The navigation component handles conversation management [9](#0-8) 

#### 2.5 Message Display
- **Description**: Styled message bubbles showing user questions and AI responses with sources
- **Reference**: ConversationBubble displays messages with formatting [10](#0-9) 

### Functional Tests (Phase 2 Complete)

**Test 2.1: Multi-Turn Conversation**
```
GIVEN a user has asked "What is machine learning?"
AND received an answer
WHEN they ask "What are its applications?"
THEN the system should understand "its" refers to "machine learning"
AND provide relevant follow-up answer
```

**Test 2.2: Source Attribution Display**
```
GIVEN a user receives an answer
WHEN the answer is displayed
THEN source citations should appear below the answer
AND show the filename and relevant text excerpt
AND allow clicking to see full source chunk
```

**Test 2.3: Conversation Persistence**
```
GIVEN a user has had a conversation
WHEN they refresh the page
THEN their conversation history should be restored
AND they can continue where they left off
```

**Test 2.4: New Conversation Creation**
```
GIVEN a user is in an existing conversation
WHEN they click "New Chat"
THEN a fresh conversation should start
AND the previous conversation should be saved in history
AND be accessible from the sidebar
```

**Test 2.5: Context-Aware Retrieval**
```
GIVEN a conversation history exists
WHEN a follow-up question is asked
THEN the question should be rephrased with conversation context
AND retrieval should use the rephrased query
AND return more contextually relevant results
```

---

## Phase 3: Knowledge Base Management

### Objective
Enable users to manage multiple document sources, creating comprehensive knowledge bases.

### Features

#### 3.1 Multiple Document Upload
- **Description**: Upload multiple documents and organize them as sources
- **Reference**: DocsGPT supports multiple source management [11](#0-10) 

#### 3.2 Source Library
- **Description**: View all uploaded sources with metadata (name, file count, chunk count, upload date)
- **Reference**: Sources are tracked with metadata in the system [12](#0-11) 

#### 3.3 Source Selection
- **Description**: Choose which sources to query in each conversation
- **Reference**: Vectorstores can be specified for retrieval [13](#0-12) 

#### 3.4 Source Management
- **Description**: Delete sources, view source details, re-index sources
- **Reference**: The worker handles document ingestion tasks [14](#0-13) 

#### 3.5 Multi-Format Support
- **Description**: Support PDF, DOCX, TXT, MD, CSV, HTML, and other common formats
- **Reference**: DocsGPT reads multiple formats [1](#0-0) 

### Functional Tests (Phase 3 Complete)

**Test 3.1: Multiple Document Upload**
```
GIVEN a user is on the sources page
WHEN they select and upload 5 different PDF files
THEN all 5 files should be processed successfully
AND appear in the sources library
AND show individual chunk counts
```

**Test 3.2: Source Selection for Query**
```
GIVEN a user has uploaded documents about "Python" and "JavaScript"
WHEN they create a new conversation
AND select only the "Python" source
AND ask "What are the best practices?"
THEN only Python-related chunks should be retrieved
AND answers should only reference Python content
```

**Test 3.3: Cross-Source Querying**
```
GIVEN a user has multiple sources uploaded
WHEN they select 2 or more sources for a conversation
THEN retrieval should search across all selected sources
AND return relevant chunks from any selected source
AND properly attribute each source in citations
```

**Test 3.4: Source Deletion**
```
GIVEN a user has uploaded 3 sources
WHEN they delete one source
THEN that source should be removed from the library
AND its chunks should be deleted from the vector database
AND conversations using that source should show a warning
```

**Test 3.5: Format Support Verification**
```
GIVEN a user has documents in PDF, DOCX, TXT, and MD formats
WHEN they upload each format
THEN all formats should be parsed correctly
AND text should be extracted accurately
AND be searchable in conversations
```

---

## Phase 4: Hybrid Search System

### Objective
Implement BM25 keyword search alongside vector search for improved retrieval accuracy.

### Features

#### 4.1 BM25 Keyword Indexing
- **Description**: Build Lunr.js keyword index alongside vector embeddings
- **Reference**: Elasticsearch vectorstore uses hybrid search combining vector and text matching [15](#0-14) 

#### 4.2 Hybrid Search Algorithm
- **Description**: Combine vector similarity search with keyword search using RRF (Reciprocal Rank Fusion)
- **Reference**: Elasticsearch implementation uses RRF ranking [16](#0-15) 

#### 4.3 Search Mode Selection
- **Description**: Allow users to choose between vector-only, keyword-only, or hybrid search
- **Reference**: Different vectorstore implementations support different search methods [17](#0-16) 

#### 4.4 Chunk Limit Configuration
- **Description**: Let users adjust how many chunks to retrieve (0, 2, 4, 6, 8, 10)
- **Reference**: Chunks are configurable in settings [18](#0-17) 

### Functional Tests (Phase 4 Complete)

**Test 4.1: Keyword Search Accuracy**
```
GIVEN documents contain specific terms like "neural network"
WHEN a user searches with exact keywords
THEN BM25 search should rank exact matches highly
AND retrieve chunks containing those exact terms
```

**Test 4.2: Semantic Search Accuracy**
```
GIVEN documents discuss "machine learning"
WHEN a user asks "What is AI training?"
THEN vector search should find semantically similar content
AND retrieve relevant chunks even without exact keyword matches
```

**Test 4.3: Hybrid Search Superiority**
```
GIVEN a query with both semantic intent and specific keywords
WHEN hybrid search is used
THEN results should be better than either method alone
AND RRF ranking should balance both approaches
```

**Test 4.4: Chunk Limit Adjustment**
```
GIVEN a user sets chunk limit to 4
WHEN they ask a question
THEN exactly 4 chunks should be retrieved
AND used in the RAG context
AND adjusting to 2 should retrieve only 2 chunks
```

**Test 4.5: No-Retrieval Mode**
```
GIVEN a user sets chunks to 0
WHEN they ask a question
THEN no retrieval should occur
AND the LLM should answer without document context
AND function as a general chatbot
```

---

## Phase 5: Agent System Foundation

### Objective
Introduce configurable agents with custom prompts and behavior.

### Features

#### 5.1 Agent Creation
- **Description**: Create named agents with descriptions and custom system prompts
- **Reference**: NewAgent component handles agent creation [19](#0-18) 

#### 5.2 System Prompt Management
- **Description**: Define and manage reusable system prompts (instructions)
- **Reference**: Prompts are managed and stored [20](#0-19) 

#### 5.3 Agent-Source Binding
- **Description**: Bind specific knowledge sources to agents
- **Reference**: Agents can be configured with specific sources [21](#0-20) 

#### 5.4 Agent Library
- **Description**: View, edit, and manage multiple agents
- **Reference**: AgentsList displays available agents [22](#0-21) 

#### 5.5 Agent Selection in Chat
- **Description**: Choose which agent to chat with for different purposes
- **Reference**: Selected agent is managed in state [23](#0-22) 

### Functional Tests (Phase 5 Complete)

**Test 5.1: Agent Creation with Custom Prompt**
```
GIVEN a user creates a new agent named "Technical Writer"
AND sets system prompt to "You are a technical documentation expert..."
WHEN they chat with this agent
THEN responses should follow the specified persona and instructions
```

**Test 5.2: Agent-Source Specificity**
```
GIVEN an agent is configured with only "Python Docs" source
WHEN a user asks this agent about JavaScript
THEN the agent should explain it can only answer about Python
AND not retrieve unrelated sources
```

**Test 5.3: Multiple Agent Management**
```
GIVEN a user has created 3 different agents
WHEN they view the agent library
THEN all 3 agents should be listed
AND show their configurations
AND allow editing or deleting any agent
```

**Test 5.4: Agent Switching**
```
GIVEN a user is chatting with "Agent A"
WHEN they switch to "Agent B"
THEN the conversation should use Agent B's configuration
AND maintain separate conversation histories
```

**Test 5.5: Prompt Templates**
```
GIVEN preset prompt templates exist (Creative, Strict, Default)
WHEN a user creates an agent
THEN they can select from templates
AND customize the template for their needs
```

---

## Phase 6: Tools & Function Calling

### Objective
Enable agents to use tools and perform actions beyond document retrieval.

### Features

#### 6.1 Tool Definition Interface
- **Description**: Define custom tools with names, descriptions, and parameters
- **Reference**: Tools are configured in the system [24](#0-23) 

#### 6.2 API Tool Actions
- **Description**: Create tools that call external APIs with configurable endpoints, methods, headers, and bodies
- **Reference**: APITool executes custom API actions [25](#0-24) 

#### 6.3 Tool Binding to Agents
- **Description**: Attach specific tools to agents, making them available during conversations
- **Reference**: Agents can be configured with tools [26](#0-25) 

#### 6.4 Function Calling
- **Description**: LLM decides when to call tools based on user queries
- **Reference**: BaseAgent prepares tools and executes tool actions [27](#0-26) 

#### 6.5 Tool Call Display
- **Description**: Show tool invocations and results in the chat interface
- **Reference**: ConversationBubble displays tool calls [10](#0-9) 

### Functional Tests (Phase 6 Complete)

**Test 6.1: Tool Creation**
```
GIVEN a user creates a new tool "Weather API"
AND configures it to call "api.weather.com/current"
WHEN they save the tool
THEN it should appear in the tools library
AND be available for agent binding
```

**Test 6.2: Agent with Tool**
```
GIVEN an agent has the "Weather API" tool attached
WHEN a user asks "What's the weather in New York?"
THEN the agent should recognize it needs weather data
AND call the Weather API tool
AND incorporate the API response in the answer
```

**Test 6.3: Tool Call Visibility**
```
GIVEN an agent calls a tool during conversation
WHEN the tool is invoked
THEN the UI should show "Calling Weather API..."
AND display the tool's arguments
AND show the returned result
AND the final answer incorporating that result
```

**Test 6.4: Multiple Tool Availability**
```
GIVEN an agent has 3 tools attached
WHEN a user's query could use multiple tools
THEN the agent should choose the appropriate tool(s)
AND call them in the correct sequence if needed
```

**Test 6.5: Tool Error Handling**
```
GIVEN a tool call fails (network error, bad response)
WHEN the tool returns an error
THEN the error should be shown in the chat
AND the agent should explain it couldn't complete that action
AND suggest alternatives if possible
```

---

## Phase 7: Sharing & Collaboration

### Objective
Enable users to share conversations and agents publicly or with specific people.

### Features

#### 7.1 Conversation Sharing
- **Description**: Generate public links to share conversation history
- **Reference**: ShareConversationModal handles conversation sharing [28](#0-27) 

#### 7.2 Promptable vs View-Only Sharing
- **Description**: Choose whether shared conversation allows continued interaction or is read-only
- **Reference**: Sharing supports isPromptable flag for interaction control [6](#0-5) 

#### 7.3 Agent Sharing
- **Description**: Share agents publicly so others can use them
- **Reference**: Agents can be shared publicly [29](#0-28) 

#### 7.4 Shared Resource Access
- **Description**: Access shared conversations and agents via public URLs
- **Reference**: SharedConversation and SharedAgent components handle shared access [30](#0-29) 

#### 7.5 Export/Import
- **Description**: Export conversations, agents, and knowledge bases for backup or sharing
- **Note**: This feature would be implemented for the browser-only version

### Functional Tests (Phase 7 Complete)

**Test 7.1: Share Conversation Link**
```
GIVEN a user has a conversation with multiple messages
WHEN they click "Share" and generate a link
THEN a unique URL should be created
AND opening that URL should show the conversation
AND preserve all messages and sources
```

**Test 7.2: View-Only Shared Conversation**
```
GIVEN a conversation is shared as view-only
WHEN someone accesses the shared link
THEN they should see all messages
BUT the input field should be disabled
AND they cannot add new messages
```

**Test 7.3: Promptable Shared Conversation**
```
GIVEN a conversation is shared as promptable
WHEN someone accesses the shared link
THEN they can see the conversation history
AND continue asking questions
AND receive answers from the same agent/sources
```

**Test 7.4: Share Agent**
```
GIVEN a user has created a custom agent
WHEN they share the agent publicly
THEN others can access it via a public URL
AND use it with their own documents
BUT cannot modify the agent configuration
```

**Test 7.5: Export Knowledge Base**
```
GIVEN a user has built a knowledge base with 10 documents
WHEN they export it
THEN a downloadable file should be generated
AND contain all document chunks and embeddings
AND be importable to restore the knowledge base
```

---

## Phase 8: Advanced Configuration & Polish

### Objective
Add settings, customization options, and quality-of-life improvements.

### Features

#### 8.1 Settings Panel
- **Description**: Centralized settings for theme, language, defaults
- **Reference**: Settings component manages preferences [31](#0-30) 

#### 8.2 Theme Customization
- **Description**: Light/dark mode with system preference detection
- **Reference**: Theme selection is available in settings [32](#0-31) 

#### 8.3 Language Localization
- **Description**: Support multiple languages (English, Spanish, Japanese, Chinese, Russian)
- **Reference**: Multiple languages are supported [33](#0-32) 

#### 8.4 Token Limit Configuration
- **Description**: Set conversation context window size (Low, Medium, Default, High, Unlimited)
- **Reference**: Token limits are configurable [34](#0-33) 

#### 8.5 Conversation Deletion
- **Description**: Delete individual or all conversations
- **Reference**: Conversation deletion is supported [6](#0-5) 

#### 8.6 File Attachments in Chat
- **Description**: Attach files directly to messages for one-off queries
- **Reference**: MessageInput handles file attachments [35](#0-34) 

#### 8.7 Search Within Conversations
- **Description**: Filter and search through conversation history
- **Note**: Quality of life feature for the browser version

#### 8.8 Keyboard Shortcuts
- **Description**: Power user features (Cmd/Ctrl+N for new chat, etc.)
- **Note**: Enhancement for user experience

### Functional Tests (Phase 8 Complete)

**Test 8.1: Theme Switching**
```
GIVEN a user is in light mode
WHEN they switch to dark mode
THEN all UI elements should update to dark theme
AND the preference should persist on reload
```

**Test 8.2: Language Change**
```
GIVEN a user selects Japanese language
WHEN the setting is applied
THEN all UI text should change to Japanese
AND maintain functionality in the new language
```

**Test 8.3: Token Limit Effect**
```
GIVEN a user sets token limit to "Low"
WHEN they have a long conversation
THEN older messages should be excluded from context
AND only recent messages within token limit are used
```

**Test 8.4: Delete All Conversations**
```
GIVEN a user has 20 conversations
WHEN they click "Delete All Conversations"
AND confirm the action
THEN all conversations should be deleted
AND conversation list should be empty
```

**Test 8.5: File Attachment in Message**
```
GIVEN a user is asking a question
WHEN they attach an image or PDF
THEN the file should upload successfully
AND be included in that specific message
AND the AI should reference the attachment content
```

**Test 8.6: Conversation Search**
```
GIVEN a user has many conversations
WHEN they search for "machine learning"
THEN only conversations containing that term should show
AND matching text should be highlighted
```

**Test 8.7: Keyboard Shortcuts**
```
GIVEN a user presses Cmd/Ctrl+N
THEN a new conversation should start
AND pressing Cmd/Ctrl+K should focus the search
```

**Test 8.8: Data Persistence**
```
GIVEN a user has used the app extensively
WHEN they close and reopen the browser
THEN all data should be restored:
- Conversations with full history
- Uploaded documents and embeddings
- Agents and their configurations
- Settings and preferences
```

---

## Phase 9: Performance & Optimization

### Objective
Ensure the app performs well with large knowledge bases and long conversations.

### Features

#### 9.1 Lazy Loading
- **Description**: Load conversations and documents on-demand rather than all at once

#### 9.2 Embedding Caching
- **Description**: Cache embeddings to avoid recomputing on every load

#### 9.3 Chunked Processing
- **Description**: Process large documents in chunks to avoid UI blocking

#### 9.4 Virtual Scrolling
- **Description**: Efficiently render long conversation histories

#### 9.5 IndexedDB Optimization
- **Description**: Optimize PGLite storage queries for faster retrieval

### Functional Tests (Phase 9 Complete)

**Test 9.1: Large Document Performance**
```
GIVEN a user uploads a 500-page PDF
WHEN processing begins
THEN the UI should remain responsive
AND show progress updates
AND complete within 2 minutes
```

**Test 9.2: Many Conversations**
```
GIVEN a user has 100 conversations
WHEN they open the app
THEN the conversation list should load quickly (<1s)
AND scrolling should be smooth
AND selecting a conversation should be instant
```

**Test 9.3: Large Knowledge Base Search**
```
GIVEN a knowledge base with 10,000 chunks
WHEN a user asks a question
THEN retrieval should complete within 500ms
AND top results should be accurate
```

**Test 9.4: Long Conversation Rendering**
```
GIVEN a conversation with 100 messages
WHEN the user scrolls through it
THEN scrolling should be smooth (60fps)
AND messages should render without lag
```

**Test 9.5: Memory Usage**
```
GIVEN extensive app usage
WHEN monitoring browser memory
THEN memory usage should stay under 500MB
AND not grow unbounded over time
```

---

## Notes

### Architecture Adaptations for Browser-Only Version

Since this PRD is based on DocsGPT which has a backend, the browser-only version requires these key adaptations:

1. **Vector Database**: Use PGLite+pgvector instead of external vectorstores like FAISS or Qdrant
2. **LLM Integration**: Use browser-compatible API calls to LLM providers (OpenAI, Anthropic, etc.) or WebLLM for local models
3. **Storage**: Use IndexedDB for storing documents, embeddings, conversations, and configuration
4. **Processing**: All document parsing and embedding must happen client-side using WebAssembly-based libraries
5. **No Server-Side Tasks**: Features like webhook agents would need alternative implementations or be scoped out

### Core Flow Reference

The RAG pipeline in DocsGPT follows this pattern:
1. **Document Ingestion** [14](#0-13) 
2. **Embedding Generation** [2](#0-1) 
3. **Vector Storage** [3](#0-2) 
4. **Query Retrieval** [36](#0-35) 
5. **Agent Orchestration** [27](#0-26) 
6. **Streaming Response** [37](#0-36) 

### Feature Priority Recommendations

**Must-Have (MVP)**: Phases 1-3
- Core RAG with single documents
- Basic chat interface
- Knowledge base management

**Should-Have**: Phases 4-5
- Hybrid search for better accuracy
- Agent system for customization

**Nice-to-Have**: Phases 6-8
- Tools and function calling
- Sharing capabilities
- Advanced settings

**Optimization**: Phase 9
- Performance enhancements for scale

### Testing Strategy

Each phase should have:
- **Unit Tests**: For individual functions (chunking, embedding, search)
- **Integration Tests**: For flow combinations (upload → embed → search)
- **E2E Tests**: For complete user journeys using Playwright
- **Performance Tests**: For response times and resource usage

The functional tests provided above serve as E2E test specifications that can be directly converted to Playwright test cases.

### Citations

**File:** README.md (L45-45)
```markdown
    <li><strong>🗂️ Wide Format Support:</strong> Reads PDF, DOCX, CSV, XLSX, EPUB, MD, RST, HTML, MDX, JSON, PPTX, and images.</li>
```

**File:** application/parser/embedding_pipeline.py (L1-50)
```python
import os
import logging
from retry import retry
from tqdm import tqdm
from application.core.settings import settings
from application.vectorstore.vector_creator import VectorCreator


def sanitize_content(content: str) -> str:
    """
    Remove NUL characters that can cause vector store ingestion to fail.
    
    Args:
        content (str): Raw content that may contain NUL characters
        
    Returns:
        str: Sanitized content with NUL characters removed
    """
    if not content:
        return content
    return content.replace('\x00', '')


@retry(tries=10, delay=60)
def add_text_to_store_with_retry(store, doc, source_id):
    """
    Add a document's text and metadata to the vector store with retry logic.
    Args:
        store: The vector store object.
        doc: The document to be added.
        source_id: Unique identifier for the source.
    """
    try:
        # Sanitize content to remove NUL characters that cause ingestion failures
        doc.page_content = sanitize_content(doc.page_content)
        
        doc.metadata["source_id"] = str(source_id)
        store.add_texts([doc.page_content], metadatas=[doc.metadata])
    except Exception as e:
        logging.error(f"Failed to add document with retry: {e}", exc_info=True)
        raise


def embed_and_store_documents(docs, folder_name, source_id, task_status):
    """
    Embeds documents and stores them in a vector store.

    Args:
        docs (list): List of documents to be embedded and stored.
        folder_name (str): Directory to save the vector store.
```

**File:** application/vectorstore/base.py (L1-50)
```python
import logging
import os
from abc import ABC, abstractmethod

from langchain_openai import OpenAIEmbeddings
from sentence_transformers import SentenceTransformer

from application.core.settings import settings


class EmbeddingsWrapper:
    def __init__(self, model_name, *args, **kwargs):
        logging.info(f"Initializing EmbeddingsWrapper with model: {model_name}")
        try:
            kwargs.setdefault("trust_remote_code", True)
            self.model = SentenceTransformer(
                model_name,
                config_kwargs={"allow_dangerous_deserialization": True},
                *args,
                **kwargs,
            )
            if self.model is None or self.model._first_module() is None:
                raise ValueError(
                    f"SentenceTransformer model failed to load properly for: {model_name}"
                )
            self.dimension = self.model.get_sentence_embedding_dimension()
            logging.info(f"Successfully loaded model with dimension: {self.dimension}")
        except Exception as e:
            logging.error(
                f"Failed to initialize SentenceTransformer with model {model_name}: {str(e)}",
                exc_info=True,
            )
            raise

    def embed_query(self, query: str):
        return self.model.encode(query).tolist()

    def embed_documents(self, documents: list):
        return self.model.encode(documents).tolist()

    def __call__(self, text):
        if isinstance(text, str):
            return self.embed_query(text)
        elif isinstance(text, list):
            return self.embed_documents(text)
        else:
            raise ValueError("Input must be a string or a list of strings")


class EmbeddingsSingleton:
```

**File:** frontend/src/conversation/Conversation.tsx (L1-50)
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import SharedAgentCard from '../agents/SharedAgentCard';
import MessageInput from '../components/MessageInput';
import { useMediaQuery } from '../hooks';
import {
  selectConversationId,
  selectSelectedAgent,
  selectToken,
} from '../preferences/preferenceSlice';
import { AppDispatch } from '../store';
import { handleSendFeedback } from './conversationHandlers';
import ConversationMessages from './ConversationMessages';
import { FEEDBACK, Query } from './conversationModels';
import {
  addQuery,
  fetchAnswer,
  resendQuery,
  selectQueries,
  selectStatus,
  setConversation,
  updateConversationId,
  updateQuery,
} from './conversationSlice';
import {
  selectCompletedAttachments,
  clearAttachments,
} from '../upload/uploadSlice';

export default function Conversation() {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();
  const dispatch = useDispatch<AppDispatch>();

  const token = useSelector(selectToken);
  const queries = useSelector(selectQueries);
  const status = useSelector(selectStatus);
  const conversationId = useSelector(selectConversationId);
  const selectedAgent = useSelector(selectSelectedAgent);
  const completedAttachments = useSelector(selectCompletedAttachments);

  const [lastQueryReturnedErr, setLastQueryReturnedErr] =
    useState<boolean>(false);
  const [isShareModalOpen, setShareModalState] = useState<boolean>(false);

  const fetchStream = useRef<any>(null);

  const handleFetchAnswer = useCallback(
```

**File:** application/retriever/classic_rag.py (L1-208)
```python
import logging
import os

from application.core.settings import settings
from application.llm.llm_creator import LLMCreator
from application.retriever.base import BaseRetriever

from application.vectorstore.vector_creator import VectorCreator


class ClassicRAG(BaseRetriever):
    def __init__(
        self,
        source,
        chat_history=None,
        prompt="",
        chunks=2,
        token_limit=150,
        gpt_model="docsgpt",
        user_api_key=None,
        llm_name=settings.LLM_PROVIDER,
        api_key=settings.API_KEY,
        decoded_token=None,
    ):
        """Initialize ClassicRAG retriever with vectorstore sources and LLM configuration"""
        self.original_question = source.get("question", "")
        self.chat_history = chat_history if chat_history is not None else []
        self.prompt = prompt
        if isinstance(chunks, str):
            try:
                self.chunks = int(chunks)
            except ValueError:
                logging.warning(
                    f"Invalid chunks value '{chunks}', using default value 2"
                )
                self.chunks = 2
        else:
            self.chunks = chunks
        user_identifier = user_api_key if user_api_key else "default"
        logging.info(
            f"ClassicRAG initialized with chunks={self.chunks}, user_api_key={user_identifier}, "
            f"sources={'active_docs' in source and source['active_docs'] is not None}"
        )
        self.gpt_model = gpt_model
        self.token_limit = (
            token_limit
            if token_limit
            < settings.LLM_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
            else settings.LLM_TOKEN_LIMITS.get(
                self.gpt_model, settings.DEFAULT_MAX_HISTORY
            )
        )
        self.user_api_key = user_api_key
        self.llm_name = llm_name
        self.api_key = api_key
        self.llm = LLMCreator.create_llm(
            self.llm_name,
            api_key=self.api_key,
            user_api_key=self.user_api_key,
            decoded_token=decoded_token,
        )

        if "active_docs" in source and source["active_docs"] is not None:
            if isinstance(source["active_docs"], list):
                self.vectorstores = source["active_docs"]
            else:
                self.vectorstores = [source["active_docs"]]
        else:
            self.vectorstores = []
        self.question = self._rephrase_query()
        self.decoded_token = decoded_token
        self._validate_vectorstore_config()

    def _validate_vectorstore_config(self):
        """Validate vectorstore IDs and remove any empty/invalid entries"""
        if not self.vectorstores:
            logging.warning("No vectorstores configured for retrieval")
            return
        invalid_ids = [
            vs_id for vs_id in self.vectorstores if not vs_id or not vs_id.strip()
        ]
        if invalid_ids:
            logging.warning(f"Found invalid vectorstore IDs: {invalid_ids}")
            self.vectorstores = [
                vs_id for vs_id in self.vectorstores if vs_id and vs_id.strip()
            ]

    def _rephrase_query(self):
        """Rephrase user query with chat history context for better retrieval"""
        if (
            not self.original_question
            or not self.chat_history
            or self.chat_history == []
            or self.chunks == 0
            or not self.vectorstores
        ):
            return self.original_question
        prompt = (
            "Given the following conversation history:\n"
            f"{self.chat_history}\n\n"
            "Rephrase the following user question to be a standalone search query "
            "that captures all relevant context from the conversation:\n"
        )

        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": self.original_question},
        ]

        try:
            rephrased_query = self.llm.gen(model=self.gpt_model, messages=messages)
            print(f"Rephrased query: {rephrased_query}")
            return rephrased_query if rephrased_query else self.original_question
        except Exception as e:
            logging.error(f"Error rephrasing query: {e}", exc_info=True)
            return self.original_question

    def _get_data(self):
        """Retrieve relevant documents from configured vectorstores"""
        if self.chunks == 0 or not self.vectorstores:
            logging.info(
                f"ClassicRAG._get_data: Skipping retrieval - chunks={self.chunks}, "
                f"vectorstores_count={len(self.vectorstores) if self.vectorstores else 0}"
            )
            return []
        all_docs = []
        chunks_per_source = max(1, self.chunks // len(self.vectorstores))

        logging.info(
            f"ClassicRAG._get_data: Starting retrieval with chunks={self.chunks}, "
            f"vectorstores={self.vectorstores}, chunks_per_source={chunks_per_source}, "
            f"query='{self.question[:50]}...'"
        )

        for vectorstore_id in self.vectorstores:
            if vectorstore_id:
                try:
                    docsearch = VectorCreator.create_vectorstore(
                        settings.VECTOR_STORE, vectorstore_id, settings.EMBEDDINGS_KEY
                    )
                    docs_temp = docsearch.search(self.question, k=chunks_per_source)

                    for doc in docs_temp:
                        if hasattr(doc, "page_content") and hasattr(doc, "metadata"):
                            page_content = doc.page_content
                            metadata = doc.metadata
                        else:
                            page_content = doc.get("text", doc.get("page_content", ""))
                            metadata = doc.get("metadata", {})
                        title = metadata.get(
                            "title", metadata.get("post_title", page_content)
                        )
                        if not isinstance(title, str):
                            title = str(title)
                        title = title.split("/")[-1]

                        filename = (
                            metadata.get("filename")
                            or metadata.get("file_name")
                            or metadata.get("source")
                        )
                        if isinstance(filename, str):
                            filename = os.path.basename(filename) or filename
                        else:
                            filename = title
                        if not filename:
                            filename = title
                        source_path = metadata.get("source") or vectorstore_id
                        all_docs.append(
                            {
                                "title": title,
                                "text": page_content,
                                "source": source_path,
                                "filename": filename,
                            }
                        )
                except Exception as e:
                    logging.error(
                        f"Error searching vectorstore {vectorstore_id}: {e}",
                        exc_info=True,
                    )
                    continue
        logging.info(
            f"ClassicRAG._get_data: Retrieval complete - retrieved {len(all_docs)} documents "
            f"(requested chunks={self.chunks}, chunks_per_source={chunks_per_source})"
        )
        return all_docs

    def search(self, query: str = ""):
        """Search for documents using optional query override"""
        if query:
            self.original_question = query
            self.question = self._rephrase_query()
        return self._get_data()

    def get_params(self):
        """Return current retriever configuration parameters"""
        return {
            "question": self.original_question,
            "rephrased_question": self.question,
            "sources": self.vectorstores,
            "chunks": self.chunks,
            "token_limit": self.token_limit,
            "gpt_model": self.gpt_model,
            "user_api_key": self.user_api_key,
        }
```

**File:** application/api/user/conversations/routes.py (L1-50)
```python
"""Conversation management routes."""

import datetime

from bson.objectid import ObjectId
from flask import current_app, jsonify, make_response, request
from flask_restx import fields, Namespace, Resource

from application.api import api
from application.api.user.base import attachments_collection, conversations_collection
from application.utils import check_required_fields

conversations_ns = Namespace(
    "conversations", description="Conversation management operations", path="/api"
)


@conversations_ns.route("/delete_conversation")
class DeleteConversation(Resource):
    @api.doc(
        description="Deletes a conversation by ID",
        params={"id": "The ID of the conversation to delete"},
    )
    def post(self):
        decoded_token = request.decoded_token
        if not decoded_token:
            return make_response(jsonify({"success": False}), 401)
        conversation_id = request.args.get("id")
        if not conversation_id:
            return make_response(
                jsonify({"success": False, "message": "ID is required"}), 400
            )
        try:
            conversations_collection.delete_one(
                {"_id": ObjectId(conversation_id), "user": decoded_token["sub"]}
            )
        except Exception as err:
            current_app.logger.error(
                f"Error deleting conversation: {err}", exc_info=True
            )
            return make_response(jsonify({"success": False}), 400)
        return make_response(jsonify({"success": True}), 200)


@conversations_ns.route("/delete_all_conversations")
class DeleteAllConversations(Resource):
    @api.doc(
        description="Deletes all conversations for a specific user",
    )
    def get(self):
```

**File:** frontend/src/Navigation.tsx (L1-50)
```typescript
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate } from 'react-router-dom';

import { Agent } from './agents/types';
import conversationService from './api/services/conversationService';
import userService from './api/services/userService';
import Add from './assets/add.svg';
import DocsGPT3 from './assets/cute_docsgpt3.svg';
import Discord from './assets/discord.svg';
import PanelLeftClose from './assets/panel-left-close.svg';
import PanelLeftOpen from './assets/panel-left-open.svg';
import Github from './assets/git_nav.svg';
import Hamburger from './assets/hamburger.svg';
import openNewChat from './assets/openNewChat.svg';
import Pin from './assets/pin.svg';
import AgentImage from './components/AgentImage';
import SettingGear from './assets/settingGear.svg';
import Spark from './assets/spark.svg';
import SpinnerDark from './assets/spinner-dark.svg';
import Spinner from './assets/spinner.svg';
import Twitter from './assets/TwitterX.svg';
import UnPin from './assets/unpin.svg';
import Help from './components/Help';
import {
  handleAbort,
  selectQueries,
  setConversation,
  updateConversationId,
} from './conversation/conversationSlice';
import ConversationTile from './conversation/ConversationTile';
import { useDarkTheme, useMediaQuery } from './hooks';
import useDefaultDocument from './hooks/useDefaultDocument';
import useTokenAuth from './hooks/useTokenAuth';
import DeleteConvModal from './modals/DeleteConvModal';
import JWTModal from './modals/JWTModal';
import { ActiveState } from './models/misc';
import { getConversations } from './preferences/preferenceApi';
import {
  selectAgents,
  selectConversationId,
  selectConversations,
  selectModalStateDeleteConv,
  selectSelectedAgent,
  selectSharedAgents,
  selectToken,
  setAgents,
  setConversations,
  setModalStateDeleteConv,
```

**File:** frontend/src/conversation/ConversationBubble.tsx (L1-50)
```typescript
import 'katex/dist/katex.min.css';

import { forwardRef, Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useSelector } from 'react-redux';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneLight,
  vscDarkPlus,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import ChevronDown from '../assets/chevron-down.svg';
import Cloud from '../assets/cloud.svg';
import DocsGPT3 from '../assets/cute_docsgpt3.svg';
import Dislike from '../assets/dislike.svg?react';
import Document from '../assets/document.svg';
import DocumentationDark from '../assets/documentation-dark.svg';
import Edit from '../assets/edit.svg';
import Like from '../assets/like.svg?react';
import Link from '../assets/link.svg';
import Sources from '../assets/sources.svg';
import UserIcon from '../assets/user.svg';
import Accordion from '../components/Accordion';
import Avatar from '../components/Avatar';
import CopyButton from '../components/CopyButton';
import MermaidRenderer from '../components/MermaidRenderer';
import Sidebar from '../components/Sidebar';
import Spinner from '../components/Spinner';
import SpeakButton from '../components/TextToSpeechButton';
import { useDarkTheme, useOutsideAlerter } from '../hooks';
import {
  selectChunks,
  selectSelectedDocs,
} from '../preferences/preferenceSlice';
import classes from './ConversationBubble.module.css';
import { FEEDBACK, MESSAGE_TYPE } from './conversationModels';
import { ToolCallsType } from './types';

const DisableSourceFE = import.meta.env.VITE_DISABLE_SOURCE_FE || false;

const ConversationBubble = forwardRef<
  HTMLDivElement,
  {
    message?: string;
    type: MESSAGE_TYPE;
    className?: string;
```

**File:** frontend/src/settings/Sources.tsx (L1-50)
```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import userService from '../api/services/userService';

import EyeView from '../assets/eye-view.svg';
import NoFilesIcon from '../assets/no-files.svg';
import NoFilesDarkIcon from '../assets/no-files-dark.svg';
import Trash from '../assets/red-trash.svg';
import SyncIcon from '../assets/sync.svg';
import ThreeDots from '../assets/three-dots.svg';
import CalendarIcon from '../assets/calendar.svg';
import DiscIcon from '../assets/disc.svg';
import ContextMenu, { MenuOption } from '../components/ContextMenu';
import Pagination from '../components/DocumentPagination';
import DropdownMenu from '../components/DropdownMenu';
import SkeletonLoader from '../components/SkeletonLoader';
import { useDarkTheme, useLoaderState } from '../hooks';
import ConfirmationModal from '../modals/ConfirmationModal';
import { ActiveState, Doc, DocumentsProps } from '../models/misc';
import { getDocs, getDocsWithPagination } from '../preferences/preferenceApi';
import {
  selectToken,
  setPaginatedDocuments,
  setSourceDocs,
} from '../preferences/preferenceSlice';
import Upload from '../upload/Upload';
import { formatDate } from '../utils/dateTimeUtils';
import FileTree from '../components/FileTree';
import ConnectorTree from '../components/ConnectorTree';
import Chunks from '../components/Chunks';

const formatTokens = (tokens: number): string => {
  const roundToTwoDecimals = (num: number): string => {
    return (Math.round((num + Number.EPSILON) * 100) / 100).toString();
  };

  if (tokens >= 1_000_000_000) {
    return roundToTwoDecimals(tokens / 1_000_000_000) + 'b';
  } else if (tokens >= 1_000_000) {
    return roundToTwoDecimals(tokens / 1_000_000) + 'm';
  } else if (tokens >= 1_000) {
    return roundToTwoDecimals(tokens / 1_000) + 'k';
  } else {
    return tokens.toString();
  }
};

export default function Sources({
```

**File:** application/api/user/sources/upload.py (L1-50)
```python
"""Source document management upload functionality."""

import json
import os
import tempfile
import zipfile

from bson.objectid import ObjectId
from flask import current_app, jsonify, make_response, request
from flask_restx import fields, Namespace, Resource

from application.api import api
from application.api.user.base import sources_collection
from application.api.user.tasks import ingest, ingest_connector_task, ingest_remote
from application.core.settings import settings
from application.parser.connectors.connector_creator import ConnectorCreator
from application.storage.storage_creator import StorageCreator
from application.utils import check_required_fields, safe_filename


sources_upload_ns = Namespace(
    "sources", description="Source document management operations", path="/api"
)


@sources_upload_ns.route("/upload")
class UploadFile(Resource):
    @api.expect(
        api.model(
            "UploadModel",
            {
                "user": fields.String(required=True, description="User ID"),
                "name": fields.String(required=True, description="Job name"),
                "file": fields.Raw(required=True, description="File(s) to upload"),
            },
        )
    )
    @api.doc(
        description="Uploads a file to be vectorized and indexed",
    )
    def post(self):
        decoded_token = request.decoded_token
        if not decoded_token:
            return make_response(jsonify({"success": False}), 401)
        data = request.form
        files = request.files.getlist("file")
        required_fields = ["user", "name"]
        missing_fields = check_required_fields(data, required_fields)
        if missing_fields or not files or all(file.filename == "" for file in files):
            return make_response(
```

**File:** application/worker.py (L1-50)
```python
import datetime
import json
import logging
import mimetypes
import os
import shutil
import string
import tempfile
from typing import Any, Dict
import zipfile

from collections import Counter
from urllib.parse import urljoin

import requests
from bson.dbref import DBRef
from bson.objectid import ObjectId

from application.agents.agent_creator import AgentCreator
from application.api.answer.services.stream_processor import get_prompt

from application.cache import get_redis_instance
from application.core.mongo_db import MongoDB
from application.core.settings import settings
from application.parser.chunking import Chunker
from application.parser.connectors.connector_creator import ConnectorCreator
from application.parser.embedding_pipeline import embed_and_store_documents
from application.parser.file.bulk import SimpleDirectoryReader
from application.parser.remote.remote_creator import RemoteCreator
from application.parser.schema.base import Document
from application.retriever.retriever_creator import RetrieverCreator

from application.storage.storage_creator import StorageCreator
from application.utils import count_tokens_docs, num_tokens_from_string

mongo = MongoDB.get_client()
db = mongo[settings.MONGO_DB_NAME]
sources_collection = db["sources"]

# Constants


MIN_TOKENS = 150
MAX_TOKENS = 1250
RECURSION_DEPTH = 2


# Define a function to extract metadata from a given filename.


```

**File:** application/vectorstore/elasticsearch.py (L1-100)
```python
from application.vectorstore.base import BaseVectorStore
from application.core.settings import settings
from application.vectorstore.document_class import Document


class ElasticsearchStore(BaseVectorStore):
    _es_connection = None  # Class attribute to hold the Elasticsearch connection

    def __init__(self, source_id, embeddings_key, index_name=settings.ELASTIC_INDEX):
        super().__init__()
        self.source_id = source_id.replace("application/indexes/", "").rstrip("/")
        self.embeddings_key = embeddings_key
        self.index_name = index_name
        
        if ElasticsearchStore._es_connection is None:
            connection_params = {}
            if settings.ELASTIC_URL:
                connection_params["hosts"] = [settings.ELASTIC_URL]
                connection_params["http_auth"] = (settings.ELASTIC_USERNAME, settings.ELASTIC_PASSWORD)
            elif settings.ELASTIC_CLOUD_ID:
                connection_params["cloud_id"] = settings.ELASTIC_CLOUD_ID
                connection_params["basic_auth"] = (settings.ELASTIC_USERNAME, settings.ELASTIC_PASSWORD)
            else:
                raise ValueError("Please provide either elasticsearch_url or cloud_id.")

            import elasticsearch
            ElasticsearchStore._es_connection = elasticsearch.Elasticsearch(**connection_params)
            
        self.docsearch = ElasticsearchStore._es_connection

    def connect_to_elasticsearch(
        *,
        es_url = None,
        cloud_id = None,
        api_key = None,
        username = None,
        password = None,
    ):
        try:
            import elasticsearch
        except ImportError:
            raise ImportError(
                "Could not import elasticsearch python package. "
                "Please install it with `pip install elasticsearch`."
            )

        if es_url and cloud_id:
            raise ValueError(
                "Both es_url and cloud_id are defined. Please provide only one."
            )

        connection_params = {}

        if es_url:
            connection_params["hosts"] = [es_url]
        elif cloud_id:
            connection_params["cloud_id"] = cloud_id
        else:
            raise ValueError("Please provide either elasticsearch_url or cloud_id.")

        if api_key:
            connection_params["api_key"] = api_key
        elif username and password:
            connection_params["basic_auth"] = (username, password)

        es_client = elasticsearch.Elasticsearch(
            **connection_params,
        )
        try:
            es_client.info()
        except Exception as e:
            raise e

        return es_client

    def search(self, question, k=2, index_name=settings.ELASTIC_INDEX, *args, **kwargs):
        embeddings = self._get_embeddings(settings.EMBEDDINGS_NAME, self.embeddings_key)
        vector = embeddings.embed_query(question)
        knn = {
            "filter": [{"match": {"metadata.source_id.keyword": self.source_id}}],
            "field": "vector",
            "k": k,
            "num_candidates": 100,
            "query_vector": vector,
        }
        full_query = {
            "knn": knn,
            "query": {
                "bool": {
                    "must": [
                        {
                            "match": {
                                "text": {
                                    "query": question,
                                }
                            }
                        }
                    ],
                    "filter": [{"match": {"metadata.source_id.keyword": self.source_id}}],
                }
```

**File:** application/vectorstore/vector_creator.py (L1-50)
```python
from application.vectorstore.faiss import FaissStore
from application.vectorstore.elasticsearch import ElasticsearchStore
from application.vectorstore.milvus import MilvusStore
from application.vectorstore.mongodb import MongoDBVectorStore
from application.vectorstore.qdrant import QdrantStore
from application.vectorstore.pgvector import PGVectorStore


class VectorCreator:
    vectorstores = {
        "faiss": FaissStore,
        "elasticsearch": ElasticsearchStore,
        "mongodb": MongoDBVectorStore,
        "qdrant": QdrantStore,
        "milvus": MilvusStore,
        "pgvector": PGVectorStore
    }

    @classmethod
    def create_vectorstore(cls, type, *args, **kwargs):
        vectorstore_class = cls.vectorstores.get(type.lower())
        if not vectorstore_class:
            raise ValueError(f"No vectorstore class found for type {type}")
        return vectorstore_class(*args, **kwargs)

```

**File:** frontend/src/settings/General.tsx (L1-50)
```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import userService from '../api/services/userService';
import Dropdown from '../components/Dropdown';
import { useDarkTheme } from '../hooks';
import {
  selectChunks,
  selectPrompt,
  selectToken,
  selectTokenLimit,
  setChunks,
  setModalStateDeleteConv,
  setPrompt,
  setTokenLimit,
} from '../preferences/preferenceSlice';
import Prompts from './Prompts';

export default function General() {
  const {
    t,
    i18n: { changeLanguage },
  } = useTranslation();
  const token = useSelector(selectToken);
  const themes = [
    { value: 'Light', label: t('settings.general.light') },
    { value: 'Dark', label: t('settings.general.dark') },
  ];

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    { label: '日本語', value: 'jp' },
    { label: '普通话', value: 'zh' },
    { label: '繁體中文（臺灣）', value: 'zhTW' },
    { label: 'Русский', value: 'ru' },
  ];
  const chunks = ['0', '2', '4', '6', '8', '10'];
  const token_limits = new Map([
    [0, t('settings.general.none')],
    [100, t('settings.general.low')],
    [1000, t('settings.general.medium')],
    [2000, t('settings.general.default')],
    [4000, t('settings.general.high')],
    [1e9, t('settings.general.unlimited')],
  ]);
  const [prompts, setPrompts] = React.useState<
    { name: string; id: string; type: string }[]
  >([]);
```

**File:** frontend/src/agents/NewAgent.tsx (L33-62)
```typescript
export default function NewAgent({ mode }: { mode: 'new' | 'edit' | 'draft' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { agentId } = useParams();

  const token = useSelector(selectToken);
  const sourceDocs = useSelector(selectSourceDocs);
  const selectedAgent = useSelector(selectSelectedAgent);

  const [effectiveMode, setEffectiveMode] = useState(mode);
  const [agent, setAgent] = useState<Agent>({
    id: agentId || '',
    name: '',
    description: '',
    image: '',
    source: '',
    sources: [],
    chunks: '2',
    retriever: 'classic',
    prompt_id: 'default',
    tools: [],
    agent_type: 'classic',
    status: '',
    json_schema: undefined,
    limited_token_mode: false,
    token_limit: undefined,
    limited_request_mode: false,
    request_limit: undefined,
  });
```

**File:** frontend/src/agents/NewAgent.tsx (L67-73)
```typescript
  const [userTools, setUserTools] = useState<OptionType[]>([]);
  const [isSourcePopupOpen, setIsSourcePopupOpen] = useState(false);
  const [isToolsPopupOpen, setIsToolsPopupOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<
    Set<string | number>
  >(new Set());
  const [selectedTools, setSelectedTools] = useState<ToolSummary[]>([]);
```

**File:** frontend/src/settings/Prompts.tsx (L1-50)
```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import userService from '../api/services/userService';
import Dropdown from '../components/Dropdown';
import { DropdownProps } from '../components/types/Dropdown.types';
import ConfirmationModal from '../modals/ConfirmationModal';
import { ActiveState, PromptProps } from '../models/misc';
import { selectToken } from '../preferences/preferenceSlice';
import PromptsModal from '../preferences/PromptsModal';

type ExtendedPromptProps = PromptProps & {
  title?: string;
  titleClassName?: string;
  dropdownProps?: Partial<DropdownProps>;
  showAddButton?: boolean;
};

export default function Prompts({
  prompts,
  selectedPrompt,
  onSelectPrompt,
  setPrompts,
  title,
  titleClassName = 'dark:text-bright-gray font-medium',
  dropdownProps = {},
  showAddButton = true,
}: ExtendedPromptProps) {
  const handleSelectPrompt = ({
    name,
    id,
    type,
  }: {
    name: string;
    id: string;
    type: string;
  }) => {
    setEditPromptName(name);
    onSelectPrompt(name, id, type);
  };

  const token = useSelector(selectToken);
  const [newPromptName, setNewPromptName] = React.useState('');
  const [newPromptContent, setNewPromptContent] = React.useState('');
  const [editPromptName, setEditPromptName] = React.useState('');
  const [editPromptContent, setEditPromptContent] = React.useState('');
  const [currentPromptEdit, setCurrentPromptEdit] = React.useState({
    id: '',
    name: '',
```

**File:** frontend/src/agents/AgentsList.tsx (L1-50)
```typescript
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import Spinner from '../components/Spinner';
import {
  setConversation,
  updateConversationId,
} from '../conversation/conversationSlice';
import {
  selectSelectedAgent,
  selectToken,
  setSelectedAgent,
} from '../preferences/preferenceSlice';
import AgentCard from './AgentCard';
import { agentSectionsConfig } from './agents.config';
import { Agent } from './types';

export default function AgentsList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  const selectedAgent = useSelector(selectSelectedAgent);

  useEffect(() => {
    dispatch(setConversation([]));
    dispatch(
      updateConversationId({
        query: { conversationId: null },
      }),
    );
    if (selectedAgent) dispatch(setSelectedAgent(null));
  }, [token]);
  return (
    <div className="p-4 md:p-12">
      <h1 className="text-eerie-black mb-0 text-[32px] font-bold lg:text-[40px] dark:text-[#E0E0E0]">
        {t('agents.title')}
      </h1>
      <p className="dark:text-gray-4000 mt-5 text-[15px] text-[#71717A]">
        {t('agents.description')}
      </p>
      {agentSectionsConfig.map((sectionConfig) => (
        <AgentSection key={sectionConfig.id} config={sectionConfig} />
      ))}
    </div>
  );
}

function AgentSection({
```

**File:** frontend/src/preferences/preferenceSlice.ts (L1-50)
```typescript
import {
  createListenerMiddleware,
  createSlice,
  isAnyOf,
  PayloadAction,
} from '@reduxjs/toolkit';

import { Agent } from '../agents/types';
import { ActiveState, Doc } from '../models/misc';
import { RootState } from '../store';
import {
  setLocalApiKey,
  setLocalRecentDocs,
  getLocalRecentDocs,
} from './preferenceApi';

export interface Preference {
  apiKey: string;
  prompt: { name: string; id: string; type: string };
  chunks: string;
  token_limit: number;
  selectedDocs: Doc[];
  sourceDocs: Doc[] | null;
  conversations: {
    data: { name: string; id: string }[] | null;
    loading: boolean;
  };
  token: string | null;
  modalState: ActiveState;
  paginatedDocuments: Doc[] | null;
  templateAgents: Agent[] | null;
  agents: Agent[] | null;
  sharedAgents: Agent[] | null;
  selectedAgent: Agent | null;
}

const initialState: Preference = {
  apiKey: 'xxx',
  prompt: { name: 'default', id: 'default', type: 'public' },
  chunks: '2',
  token_limit: 2000,
  selectedDocs: [
    {
      id: 'default',
      name: 'default',
      type: 'remote',
      date: 'default',
      model: 'openai_text-embedding-ada-002',
      retriever: 'classic',
    },
```

**File:** frontend/src/settings/Tools.tsx (L1-50)
```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import userService from '../api/services/userService';
import ThreeDotsIcon from '../assets/three-dots.svg';
import NoFilesIcon from '../assets/no-files.svg';
import NoFilesDarkIcon from '../assets/no-files-dark.svg';
import Input from '../components/Input';
import Spinner from '../components/Spinner';
import ToggleSwitch from '../components/ToggleSwitch';
import { useDarkTheme } from '../hooks';
import AddToolModal from '../modals/AddToolModal';
import { ActiveState } from '../models/misc';
import { selectToken } from '../preferences/preferenceSlice';
import ToolConfig from './ToolConfig';
import { APIToolType, UserToolType } from './types';
import ContextMenu, { MenuOption } from '../components/ContextMenu';
import Edit from '../assets/edit.svg';
import Trash from '../assets/red-trash.svg';
import ConfirmationModal from '../modals/ConfirmationModal';

export default function Tools() {
  const { t } = useTranslation();
  const token = useSelector(selectToken);
  const [isDarkTheme] = useDarkTheme();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [addToolModalState, setAddToolModalState] =
    React.useState<ActiveState>('INACTIVE');
  const [userTools, setUserTools] = React.useState<UserToolType[]>([]);
  const [selectedTool, setSelectedTool] = React.useState<
    UserToolType | APIToolType | null
  >(null);
  const [loading, setLoading] = React.useState(false);
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const menuRefs = React.useRef<{
    [key: string]: React.RefObject<HTMLDivElement | null>;
  }>({});
  const [deleteModalState, setDeleteModalState] =
    React.useState<ActiveState>('INACTIVE');
  const [toolToDelete, setToolToDelete] = React.useState<UserToolType | null>(
    null,
  );

  React.useEffect(() => {
    userTools.forEach((tool) => {
      if (!menuRefs.current[tool.id]) {
        menuRefs.current[tool.id] = React.createRef<HTMLDivElement>();
      }
```

**File:** application/agents/tools/api_tool.py (L1-50)
```python
import json

import requests
from application.agents.tools.base import Tool


class APITool(Tool):
    """
    API Tool
    A flexible tool for performing various API actions (e.g., sending messages, retrieving data) via custom user-specified APIs
    """

    def __init__(self, config):
        self.config = config
        self.url = config.get("url", "")
        self.method = config.get("method", "GET")
        self.headers = config.get("headers", {"Content-Type": "application/json"})
        self.query_params = config.get("query_params", {})

    def execute_action(self, action_name, **kwargs):
        return self._make_api_call(
            self.url, self.method, self.headers, self.query_params, kwargs
        )

    def _make_api_call(self, url, method, headers, query_params, body):
        if query_params:
            url = f"{url}?{requests.compat.urlencode(query_params)}"
        # if isinstance(body, dict):
        #     body = json.dumps(body)
        try:
            print(f"Making API call: {method} {url} with body: {body}")
            if body == "{}":
                body = None
            response = requests.request(method, url, headers=headers, data=body)
            response.raise_for_status()
            content_type = response.headers.get(
                "Content-Type", "application/json"
            ).lower()
            if "application/json" in content_type:
                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON: {e}.  Raw response: {response.text}")
                    return {
                        "status_code": response.status_code,
                        "message": f"API call returned invalid JSON.  Error: {e}",
                        "data": response.text,
                    }
            elif "text/" in content_type or "application/xml" in content_type:
                data = response.text
```

**File:** application/agents/base.py (L1-50)
```python
import logging
import uuid
from abc import ABC, abstractmethod
from typing import Dict, Generator, List, Optional

from bson.objectid import ObjectId

from application.agents.tools.tool_action_parser import ToolActionParser
from application.agents.tools.tool_manager import ToolManager
from application.core.mongo_db import MongoDB
from application.core.settings import settings
from application.llm.handlers.handler_creator import LLMHandlerCreator
from application.llm.llm_creator import LLMCreator
from application.logging import build_stack_data, log_activity, LogContext
from application.retriever.base import BaseRetriever

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    def __init__(
        self,
        endpoint: str,
        llm_name: str,
        gpt_model: str,
        api_key: str,
        user_api_key: Optional[str] = None,
        prompt: str = "",
        chat_history: Optional[List[Dict]] = None,
        decoded_token: Optional[Dict] = None,
        attachments: Optional[List[Dict]] = None,
        json_schema: Optional[Dict] = None,
        limited_token_mode: Optional[bool] = False,
        token_limit: Optional[int] = settings.DEFAULT_AGENT_LIMITS["token_limit"],
        limited_request_mode: Optional[bool] = False,
        request_limit: Optional[int] = settings.DEFAULT_AGENT_LIMITS["request_limit"],
    ):
        self.endpoint = endpoint
        self.llm_name = llm_name
        self.gpt_model = gpt_model
        self.api_key = api_key
        self.user_api_key = user_api_key
        self.prompt = prompt
        self.decoded_token = decoded_token or {}
        self.user: str = self.decoded_token.get("sub")
        self.tool_config: Dict = {}
        self.tools: List[Dict] = []
        self.tool_calls: List[Dict] = []
        self.chat_history: List[Dict] = chat_history if chat_history is not None else []
        self.llm = LLMCreator.create_llm(
```

**File:** frontend/src/modals/ShareConversationModal.tsx (L1-50)
```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import conversationService from '../api/services/conversationService';
import Spinner from '../assets/spinner.svg';
import Dropdown from '../components/Dropdown';
import ToggleSwitch from '../components/ToggleSwitch';
import { Doc } from '../models/misc';
import {
  selectChunks,
  selectPrompt,
  selectSelectedDocs,
  selectSourceDocs,
  selectToken,
} from '../preferences/preferenceSlice';
import WrapperModal from './WrapperModal';

const apiHost = import.meta.env.VITE_API_HOST || 'https://docsapi.arc53.com';
const embeddingsName =
  import.meta.env.VITE_EMBEDDINGS_NAME ||
  'huggingface_sentence-transformers/all-mpnet-base-v2';

type StatusType = 'loading' | 'idle' | 'fetched' | 'failed';

export const ShareConversationModal = ({
  close,
  conversationId,
}: {
  close: () => void;
  conversationId: string;
}) => {
  const { t } = useTranslation();
  const token = useSelector(selectToken);

  const domain = window.location.origin;

  const [identifier, setIdentifier] = useState<null | string>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [status, setStatus] = useState<StatusType>('idle');
  const [allowPrompt, setAllowPrompt] = useState<boolean>(false);

  const sourceDocs = useSelector(selectSourceDocs);
  const preSelectedDoc = useSelector(selectSelectedDocs);
  const selectedPrompt = useSelector(selectPrompt);
  const selectedChunk = useSelector(selectChunks);

  const extractDocPaths = (docs: Doc[]) =>
    docs
      ? docs
```

**File:** application/api/user/agents/sharing.py (L1-50)
```python
"""Agent management sharing functionality."""

import datetime
import secrets

from bson import DBRef
from bson.objectid import ObjectId
from flask import current_app, jsonify, make_response, request
from flask_restx import fields, Namespace, Resource

from application.api import api
from application.core.settings import settings
from application.api.user.base import (
    agents_collection,
    db,
    ensure_user_doc,
    resolve_tool_details,
    user_tools_collection,
    users_collection,
)
from application.utils import generate_image_url

agents_sharing_ns = Namespace(
    "agents", description="Agent management operations", path="/api"
)


@agents_sharing_ns.route("/shared_agent")
class SharedAgent(Resource):
    @api.doc(
        params={
            "token": "Shared token of the agent",
        },
        description="Get a shared agent by token or ID",
    )
    def get(self):
        shared_token = request.args.get("token")

        if not shared_token:
            return make_response(
                jsonify({"success": False, "message": "Token or ID is required"}), 400
            )
        try:
            query = {
                "shared_publicly": True,
                "shared_token": shared_token,
            }
            shared_agent = agents_collection.find_one(query)
            if not shared_agent:
                return make_response(
```

**File:** frontend/src/conversation/SharedConversation.tsx (L1-50)
```typescript
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import conversationService from '../api/services/conversationService';
import MessageInput from '../components/MessageInput';
import { selectToken } from '../preferences/preferenceSlice';
import { AppDispatch } from '../store';
import { formatDate } from '../utils/dateTimeUtils';
import ConversationMessages from './ConversationMessages';
import {
  addQuery,
  fetchSharedAnswer,
  selectClientAPIKey,
  selectDate,
  selectQueries,
  selectStatus,
  selectTitle,
  setClientApiKey,
  setFetchedData,
  setIdentifier,
  updateQuery,
} from './sharedConversationSlice';
import { selectCompletedAttachments } from '../upload/uploadSlice';
import { Head as DocumentHead } from '../components/Head';

export const SharedConversation = () => {
  const navigate = useNavigate();
  const { identifier } = useParams(); //identifier is a uuid, not conversationId

  const token = useSelector(selectToken);
  const queries = useSelector(selectQueries);
  const title = useSelector(selectTitle);
  const date = useSelector(selectDate);
  const apiKey = useSelector(selectClientAPIKey);
  const status = useSelector(selectStatus);
  const completedAttachments = useSelector(selectCompletedAttachments);

  const { t } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();

  const [lastQueryReturnedErr, setLastQueryReturnedErr] = useState(false);

  useEffect(() => {
    identifier && dispatch(setIdentifier(identifier));
  }, []);

  useEffect(() => {
    if (queries.length) {
```

**File:** frontend/src/components/MessageInput.tsx (L1-50)
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import endpoints from '../api/endpoints';
import userService from '../api/services/userService';
import AlertIcon from '../assets/alert.svg';
import ClipIcon from '../assets/clip.svg';
import DragFileUpload from '../assets/DragFileUpload.svg';
import ExitIcon from '../assets/exit.svg';
import SendArrowIcon from './SendArrowIcon';
import SourceIcon from '../assets/source.svg';
import DocumentationDark from '../assets/documentation-dark.svg';
import ToolIcon from '../assets/tool.svg';
import {
  addAttachment,
  removeAttachment,
  selectAttachments,
  updateAttachment,
} from '../upload/uploadSlice';
import { reorderAttachments } from '../upload/uploadSlice';

import { ActiveState } from '../models/misc';
import {
  selectSelectedDocs,
  selectToken,
} from '../preferences/preferenceSlice';
import Upload from '../upload/Upload';
import { getOS, isTouchDevice } from '../utils/browserUtils';
import SourcesPopup from './SourcesPopup';
import ToolsPopup from './ToolsPopup';
import { handleAbort } from '../conversation/conversationSlice';

type MessageInputProps = {
  onSubmit: (text: string) => void;
  loading: boolean;
  showSourceButton?: boolean;
  showToolButton?: boolean;
  autoFocus?: boolean;
};

export default function MessageInput({
  onSubmit,
  loading,
  showSourceButton = true,
  showToolButton = true,
  autoFocus = true,
}: MessageInputProps) {
```

**File:** application/api/answer/services/stream_processor.py (L1-50)
```python
import datetime
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

from bson.dbref import DBRef

from bson.objectid import ObjectId

from application.agents.agent_creator import AgentCreator
from application.api.answer.services.conversation_service import ConversationService
from application.core.mongo_db import MongoDB
from application.core.settings import settings
from application.retriever.retriever_creator import RetrieverCreator
from application.utils import get_gpt_model, limit_chat_history

logger = logging.getLogger(__name__)


def get_prompt(prompt_id: str, prompts_collection=None) -> str:
    """
    Get a prompt by preset name or MongoDB ID
    """
    current_dir = Path(__file__).resolve().parents[3]
    prompts_dir = current_dir / "prompts"

    preset_mapping = {
        "default": "chat_combine_default.txt",
        "creative": "chat_combine_creative.txt",
        "strict": "chat_combine_strict.txt",
        "reduce": "chat_reduce_prompt.txt",
    }

    if prompt_id in preset_mapping:
        file_path = os.path.join(prompts_dir, preset_mapping[prompt_id])
        try:
            with open(file_path, "r") as f:
                return f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"Prompt file not found: {file_path}")
    try:
        if prompts_collection is None:
            mongo = MongoDB.get_client()
            db = mongo[settings.MONGO_DB_NAME]
            prompts_collection = db["prompts"]
        prompt_doc = prompts_collection.find_one({"_id": ObjectId(prompt_id)})
        if not prompt_doc:
            raise ValueError(f"Prompt with ID {prompt_id} not found")
```
