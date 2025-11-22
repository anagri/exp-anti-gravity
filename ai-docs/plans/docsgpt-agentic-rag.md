# Agentic RAG Workflow in DocsGPT

## Overview

DocsGPT implements an **agentic RAG (Retrieval-Augmented Generation) workflow** that combines document retrieval, configurable agents, and external tool integration to provide intelligent question-answering capabilities. The system uses a modular architecture where agents orchestrate the flow between retrievers, LLM providers, and tools.

## Core Workflow Components

### 1. Agent Architecture

The system provides two agent types through a factory pattern:

**Agent Types:**

- **Classic Agent**: Sequential execution with retrieval → tool preparation → LLM generation → response handling
- **ReAct Agent**: Iterative reasoning with planning, observation, and tool execution cycles [1](#2-0)

The base agent class provides core functionality for all agent types: [2](#2-1)

### 2. Document Retrieval Integration

#### Retriever Search Flow

Agents use a retriever abstraction to search for relevant document chunks: [3](#2-2)

The retriever queries vector stores and returns semantically similar document chunks that are then injected into the LLM context.

#### Classic Agent Workflow

The Classic Agent implements a straightforward five-step process: [4](#2-3)

### 3. Tool Integration System

#### Tool Discovery and Loading

Tools are dynamically loaded from MongoDB and instantiated through the ToolManager: [5](#2-4) [6](#2-5)

#### Tool Preparation for LLM

Tools are converted into function calling schemas that LLMs can understand: [7](#2-6)

#### Tool Execution Flow

When the LLM requests a tool call, the agent executes it and returns results: [8](#2-7)

### 4. Agent Configuration System

#### Configuration Storage

Agent configurations are stored in MongoDB with the following structure: [9](#2-8)

#### Stream Processor Configuration

The StreamProcessor orchestrates agent and retriever creation based on stored configurations: [10](#2-9) [11](#2-10)

### 5. LLM Handler Integration

The LLM handler processes streaming responses and manages tool call orchestration: [12](#2-11) [13](#2-12)

### 6. Complete Answer Flow

The complete streaming workflow ties everything together: [14](#2-13)

### 7. ReAct Agent Reasoning Loop

For complex multi-step reasoning, the ReAct agent uses iterative planning: [15](#2-14)

---

## Phase-Wise Test-Driven Product Requirements Document

### Phase 1: Core RAG Infrastructure

#### Epic 1.1: Document Ingestion & Vector Storage

**User Story**: As a user, I want to upload documents so they can be searched semantically.

**Acceptance Criteria**:

- ✅ Support multiple file formats (.pdf, .docx, .md, .txt)
- ✅ Chunk documents with configurable token limits (150-1250 tokens)
- ✅ Generate embeddings and store in vector database
- ✅ Support multiple vector stores (FAISS, Elasticsearch, Qdrant, Milvus, LanceDB)

**Test Cases**:

```gherkin
Given a PDF document with 100 pages
When I upload it to the system
Then it should be chunked into ~80 chunks
And each chunk should have embeddings stored
And I should receive a source_id for retrieval
```

**Implementation References**: [16](#2-15)

#### Epic 1.2: Vector Retrieval System

**User Story**: As an agent, I need to retrieve relevant document chunks for a query.

**Acceptance Criteria**:

- ✅ Perform semantic similarity search
- ✅ Return configurable number of chunks (default: 2)
- ✅ Support multiple source querying
- ✅ Include metadata (filename, source) with results

**Test Cases**:

```gherkin
Given a vectorized document about Python programming
When I search for "how to use decorators"
Then I should receive the top 2 most relevant chunks
And each chunk should include source filename
```

**Implementation References**: [17](#2-16)

---

### Phase 2: Agent System Foundation

#### Epic 2.1: Base Agent Framework

**User Story**: As a developer, I want a base agent class to standardize agent behavior.

**Acceptance Criteria**:

- ✅ Abstract `gen()` method for query processing
- ✅ Tool management (loading, preparing, executing)
- ✅ Message building with context injection
- ✅ LLM generation with streaming support
- ✅ Token and request limit enforcement

**Test Cases**:

```python
def test_base_agent_tool_preparation():
    """Test that tools are correctly formatted for LLM"""
    agent = BaseAgent(...)
    tools_dict = {"tool1": {"name": "api_tool", "config": {...}}}
    agent._prepare_tools(tools_dict)

    assert len(agent.tools) > 0
    assert agent.tools[0]["type"] == "function"
    assert "name" in agent.tools[0]["function"]
    assert "parameters" in agent.tools[0]["function"]
```

**Implementation References**: [18](#2-17)

#### Epic 2.2: Classic Agent Implementation

**User Story**: As a user, I want a straightforward agent that retrieves, generates, and responds.

**Acceptance Criteria**:

- ✅ Five-step execution: retrieve → prepare tools → build messages → generate → handle response
- ✅ Return sources and tool calls metadata
- ✅ Support streaming responses
- ✅ Log execution for debugging

**Test Cases**:

```python
def test_classic_agent_workflow():
    """Test complete classic agent execution"""
    agent = ClassicAgent(...)
    retriever = Mock()
    retriever.search.return_value = [{"text": "Python is great", "source": "doc1.md"}]

    results = list(agent.gen("What is Python?", retriever))

    # Should yield answer, sources, and tool_calls
    answer = next(r for r in results if "answer" in r)
    sources = next(r for r in results if "sources" in r)
    tool_calls = next(r for r in results if "tool_calls" in r)

    assert "Python" in answer["answer"]
    assert len(sources["sources"]) > 0
```

**Implementation References**: [19](#2-18)

#### Epic 2.3: ReAct Agent with Reasoning

**User Story**: As a power user, I want an agent that reasons through complex queries step-by-step.

**Acceptance Criteria**:

- ✅ Create execution plan before answering
- ✅ Iteratively execute and observe (max 10 iterations)
- ✅ Use tools based on observations
- ✅ Stream thoughts to user
- ✅ Generate final synthesized answer

**Test Cases**:

```python
def test_react_agent_planning():
    """Test that ReAct agent creates a plan"""
    agent = ReActAgent(...)
    retriever = Mock()

    results = list(agent.gen("Calculate 45 * 67 and summarize doc", retriever))

    # Should include thought events
    thoughts = [r for r in results if "thought" in r]
    assert len(thoughts) > 0
    assert "Plan:" in "".join([t["thought"] for t in thoughts])
```

**Implementation References**: [20](#2-19)

---

### Phase 3: Tool Integration System

#### Epic 3.1: Tool Management Framework

**User Story**: As an agent, I need to discover and execute external tools.

**Acceptance Criteria**:

- ✅ Dynamic tool loading from filesystem
- ✅ Tool instantiation with configuration
- ✅ Action execution with parameter passing
- ✅ Error handling for tool failures
- ✅ User-specific tool isolation (for memory/notes tools)

**Test Cases**:

```python
def test_tool_manager_loading():
    """Test dynamic tool discovery"""
    manager = ToolManager(config={})
    manager.load_tools()

    assert "duckduckgo" in manager.tools
    assert "memory" in manager.tools

def test_tool_execution():
    """Test tool action execution"""
    manager = ToolManager(config={})
    tool = manager.load_tool("duckduckgo", {"max_results": 5})

    result = tool.execute_action("search", query="Python tutorials")
    assert isinstance(result, list)
    assert len(result) <= 5
```

**Implementation References**: [21](#2-20)

#### Epic 3.2: Tool Call Parsing & Execution

**User Story**: As an agent, I need to parse LLM tool calls and execute them safely.

**Acceptance Criteria**:

- ✅ Parse tool calls from different LLM formats
- ✅ Extract tool_id, action_name, and arguments
- ✅ Validate tool exists before execution
- ✅ Return structured results with status
- ✅ Handle execution errors gracefully

**Test Cases**:

```python
def test_tool_execution_success():
    """Test successful tool execution"""
    agent = BaseAgent(...)
    tools_dict = {"0": {"name": "duckduckgo", "actions": [...]}}

    mock_call = Mock()
    mock_call.name = "search_0"
    mock_call.arguments = '{"query": "test"}'

    results = list(agent._execute_tool_action(tools_dict, mock_call))

    # Should yield pending, then completed events
    pending = results[0]
    completed = results[-1]

    assert pending["data"]["status"] == "pending"
    assert completed["data"]["status"] == "completed"
    assert "result" in completed["data"]
```

**Implementation References**: [22](#2-21)

#### Epic 3.3: Built-in Tool Library

**User Story**: As a user, I want pre-built tools for common tasks (search, memory, notifications).

**Acceptance Criteria**:

- ✅ DuckDuckGo search tool
- ✅ Brave search tool
- ✅ Memory/notes storage tool (user-isolated)
- ✅ Todo list management
- ✅ Telegram notifications
- ✅ Webpage reading tool
- ✅ PostgreSQL query tool
- ✅ MCP (Model Context Protocol) integration

**Test Cases**:

```python
def test_memory_tool_user_isolation():
    """Test that memory tool isolates data by user"""
    tool1 = MemoryTool(config={"tool_id": "mem1"}, user_id="user1")
    tool2 = MemoryTool(config={"tool_id": "mem2"}, user_id="user2")

    tool1.execute_action("remember", key="secret", value="user1_data")
    result = tool2.execute_action("recall", key="secret")

    assert result is None  # user2 cannot access user1's memory
```

**Implementation References**: [23](#2-22)

---

### Phase 4: Configuration & API Layer

#### Epic 4.1: Agent Configuration Storage

**User Story**: As a user, I want to save agent configurations for reuse.

**Acceptance Criteria**:

- ✅ Store agent name, description, and image
- ✅ Link to document sources (single or multiple)
- ✅ Configure retriever type and chunk count
- ✅ Assign system prompt template
- ✅ Select agent type (classic/react)
- ✅ Attach tools by ID
- ✅ Set JSON schema for structured output
- ✅ Configure token/request limits
- ✅ Generate unique API key per agent

**Test Cases**:

```python
def test_agent_configuration_crud():
    """Test agent configuration CRUD operations"""
    agent_data = {
        "name": "Python Assistant",
        "agent_type": "classic",
        "sources": [source_id1, source_id2],
        "chunks": 3,
        "retriever": "classic",
        "prompt_id": "strict",
        "tools": [tool_id1, tool_id2],
        "user": "user123"
    }

    # Create
    response = client.post("/api/create_agent", json=agent_data)
    assert response.status_code == 200
    agent_id = response.json()["id"]
    api_key = response.json()["key"]

    # Read
    response = client.get(f"/api/get_agent?id={agent_id}")
    assert response.json()["name"] == "Python Assistant"
    assert response.json()["chunks"] == 3

    # Use API key for queries
    response = client.post("/api/answer", json={
        "question": "How to use decorators?",
        "api_key": api_key
    })
    assert response.status_code == 200
```

**Implementation References**: [24](#2-23)

#### Epic 4.2: Stream Processing Pipeline

**User Story**: As the system, I need to orchestrate agent+retriever creation from stored configs.

**Acceptance Criteria**:

- ✅ Load agent configuration from agent_id or api_key
- ✅ Resolve source references (DBRef → source_id)
- ✅ Create agent with correct LLM, prompt, and history
- ✅ Create retriever with correct sources and chunks
- ✅ Handle shared agent access permissions
- ✅ Load conversation history if conversation_id provided

**Test Cases**:

```python
def test_stream_processor_initialization():
    """Test StreamProcessor configuration loading"""
    request_data = {
        "agent_id": "agent123",
        "question": "What is Python?",
        "conversation_id": "conv456"
    }

    processor = StreamProcessor(request_data, decoded_token)
    processor.initialize()

    assert processor.agent_config["agent_type"] in ["classic", "react"]
    assert processor.agent_config["prompt_id"] is not None
    assert len(processor.history) >= 0
    assert processor.retriever_config["chunks"] > 0

    agent = processor.create_agent()
    retriever = processor.create_retriever()

    assert agent is not None
    assert retriever is not None
```

**Implementation References**: [25](#2-24)

#### Epic 4.3: Streaming Answer Endpoint

**User Story**: As a user, I want real-time streaming responses with sources and tool calls.

**Acceptance Criteria**:

- ✅ Server-Sent Events (SSE) protocol
- ✅ Stream answer tokens incrementally
- ✅ Stream agent thoughts (for ReAct)
- ✅ Emit source citations
- ✅ Emit tool call events (pending/completed/error)
- ✅ Handle structured JSON output
- ✅ Save conversation to database
- ✅ Enforce usage limits (token/request)

**Test Cases**:

```python
def test_streaming_answer_endpoint():
    """Test streaming answer with all event types"""
    events = []

    with client.stream("POST", "/api/answer", json={
        "question": "Search for Python tutorials and summarize",
        "agent_id": "react_agent_id"
    }) as response:
        for line in response.iter_lines():
            if line.startswith("data: "):
                event = json.loads(line[6:])
                events.append(event)

    # Verify event types
    event_types = {e["type"] for e in events}
    assert "thought" in event_types  # ReAct reasoning
    assert "tool_call" in event_types  # Tool execution
    assert "answer" in event_types  # LLM response
    assert "source" in event_types  # Citations
    assert "id" in event_types  # Conversation ID
    assert "end" in event_types  # Stream termination
```

**Implementation References**: [26](#2-25)

---

### Phase 5: Advanced Features

#### Epic 5.1: Usage Limits & Rate Limiting

**User Story**: As an admin, I want to enforce token and request limits per agent.

**Acceptance Criteria**:

- ✅ Track token usage per API key (24-hour rolling window)
- ✅ Track request count per API key
- ✅ Block requests when limits exceeded (429 status)
- ✅ Store usage metrics in MongoDB
- ✅ Configurable limits per agent

**Test Cases**:

```python
def test_usage_limit_enforcement():
    """Test that limits are enforced"""
    agent = create_agent(limited_token_mode=True, token_limit=1000)

    # Use up the token limit
    for i in range(10):
        client.post("/api/answer", json={
            "api_key": agent.key,
            "question": "Long question" * 100
        })

    # Next request should be blocked
    response = client.post("/api/answer", json={
        "api_key": agent.key,
        "question": "Should be blocked"
    })

    assert response.status_code == 429
    assert "usage limit" in response.json()["message"].lower()
```

**Implementation References**: [27](#2-26)

#### Epic 5.2: Agent Sharing

**User Story**: As a user, I want to share my agents publicly or with specific users.

**Acceptance Criteria**:

- ✅ Generate unique share token per agent
- ✅ Public sharing toggle
- ✅ Whitelist specific users
- ✅ Shared agents have separate usage tracking
- ✅ Owner retains full control

**Implementation References**: [28](#2-27)

#### Epic 5.3: Webhook Integration

**User Story**: As a developer, I want to trigger agents via webhooks.

**Acceptance Criteria**:

- ✅ POST webhook endpoint per agent
- ✅ Background processing via Celery
- ✅ Return complete response (not streaming)
- ✅ Include answer, sources, tool_calls in result

**Test Cases**:

```python
def test_agent_webhook_execution():
    """Test webhook-triggered agent execution"""
    response = client.post(f"/api/agents/webhook/{agent_id}", json={
        "input": "Summarize the latest documentation"
    })

    assert response.status_code == 200
    task_id = response.json()["task_id"]

    # Poll for result
    result = wait_for_task(task_id)

    assert "answer" in result
    assert "sources" in result
    assert len(result["sources"]) > 0
```

**Implementation References**: [29](#2-28)

---

## Notes

**Architecture Highlights:**

1. **Modularity**: The agent system uses abstract base classes and factory patterns for extensibility
2. **Streaming**: All responses support Server-Sent Events for real-time updates
3. **Tool Isolation**: Memory and note tools are user-scoped to prevent data leakage
4. **Configuration-Driven**: Agents are fully configurable through MongoDB storage
5. **Multi-LLM Support**: The system abstracts LLM providers through handlers

**Key Design Patterns:**

- **Factory Pattern**: AgentCreator, RetrieverCreator, ToolManager
- **Strategy Pattern**: Different agent types (Classic vs ReAct)
- **Observer Pattern**: Streaming events for frontend updates
- **Repository Pattern**: MongoDB collections for configuration storage

**Testing Strategy:**

- **Unit Tests**: Test individual components (tool parsing, message building)
- **Integration Tests**: Test agent→retriever→LLM flow
- **End-to-End Tests**: Test complete API request→response cycle
- **Performance Tests**: Verify token limits and streaming performance

This architecture enables flexible, extensible RAG systems with tool augmentation and configurable reasoning strategies.

### Citations

**File:** application/agents/agent_creator.py (L5-16)

```python
class AgentCreator:
    agents = {
        "classic": ClassicAgent,
        "react": ReActAgent,
    }

    @classmethod
    def create_agent(cls, type, *args, **kwargs):
        agent_class = cls.agents.get(type.lower())
        if not agent_class:
            raise ValueError(f"No agent class found for type {type}")
        return agent_class(*args, **kwargs)
```

**File:** application/agents/base.py (L20-65)

```python
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
            llm_name,
            api_key=api_key,
            user_api_key=user_api_key,
            decoded_token=decoded_token,
        )
        self.llm_handler = LLMHandlerCreator.create_handler(
            llm_name if llm_name else "default"
        )
        self.attachments = attachments or []
        self.json_schema = json_schema
        self.limited_token_mode = limited_token_mode
        self.token_limit = token_limit
        self.limited_request_mode = limited_request_mode
        self.request_limit = request_limit

```

**File:** application/agents/base.py (L66-76)

```python
    @log_activity()
    def gen(
        self, query: str, retriever: BaseRetriever, log_context: LogContext = None
    ) -> Generator[Dict, None, None]:
        yield from self._gen_inner(query, retriever, log_context)

    @abstractmethod
    def _gen_inner(
        self, query: str, retriever: BaseRetriever, log_context: LogContext
    ) -> Generator[Dict, None, None]:
        pass
```

**File:** application/agents/base.py (L78-97)

```python
    def _get_tools(self, api_key: str = None) -> Dict[str, Dict]:
        mongo = MongoDB.get_client()
        db = mongo[settings.MONGO_DB_NAME]
        agents_collection = db["agents"]
        tools_collection = db["user_tools"]

        agent_data = agents_collection.find_one({"key": api_key or self.user_api_key})
        tool_ids = agent_data.get("tools", []) if agent_data else []

        tools = (
            tools_collection.find(
                {"_id": {"$in": [ObjectId(tool_id) for tool_id in tool_ids]}}
            )
            if tool_ids
            else []
        )
        tools = list(tools)
        tools_by_id = {str(tool["_id"]): tool for tool in tools} if tools else {}

        return tools_by_id
```

**File:** application/agents/base.py (L123-144)

```python
    def _prepare_tools(self, tools_dict):
        self.tools = [
            {
                "type": "function",
                "function": {
                    "name": f"{action['name']}_{tool_id}",
                    "description": action["description"],
                    "parameters": self._build_tool_parameters(action),
                },
            }
            for tool_id, tool in tools_dict.items()
            if (
                (tool["name"] == "api_tool" and "actions" in tool.get("config", {}))
                or (tool["name"] != "api_tool" and "actions" in tool)
            )
            for action in (
                tool["config"]["actions"].values()
                if tool["name"] == "api_tool"
                else tool["actions"]
            )
            if action.get("active", True)
        ]
```

**File:** application/agents/base.py (L146-259)

```python
    def _execute_tool_action(self, tools_dict, call):
        parser = ToolActionParser(self.llm.__class__.__name__)
        tool_id, action_name, call_args = parser.parse_args(call)

        call_id = getattr(call, "id", None) or str(uuid.uuid4())

        # Check if parsing failed
        if tool_id is None or action_name is None:
            error_message = f"Error: Failed to parse LLM tool call. Tool name: {getattr(call, 'name', 'unknown')}"
            logger.error(error_message)

            tool_call_data = {
                "tool_name": "unknown",
                "call_id": call_id,
                "action_name": getattr(call, "name", "unknown"),
                "arguments": call_args or {},
                "result": f"Failed to parse tool call. Invalid tool name format: {getattr(call, 'name', 'unknown')}",
            }
            yield {"type": "tool_call", "data": {**tool_call_data, "status": "error"}}
            self.tool_calls.append(tool_call_data)
            return "Failed to parse tool call.", call_id

        # Check if tool_id exists in available tools
        if tool_id not in tools_dict:
            error_message = f"Error: Tool ID '{tool_id}' extracted from LLM call not found in available tools_dict. Available IDs: {list(tools_dict.keys())}"
            logger.error(error_message)

            # Return error result
            tool_call_data = {
                "tool_name": "unknown",
                "call_id": call_id,
                "action_name": f"{action_name}_{tool_id}",
                "arguments": call_args,
                "result": f"Tool with ID {tool_id} not found. Available tools: {list(tools_dict.keys())}",
            }
            yield {"type": "tool_call", "data": {**tool_call_data, "status": "error"}}
            self.tool_calls.append(tool_call_data)
            return f"Tool with ID {tool_id} not found.", call_id

        tool_call_data = {
            "tool_name": tools_dict[tool_id]["name"],
            "call_id": call_id,
            "action_name": f"{action_name}_{tool_id}",
            "arguments": call_args,
        }
        yield {"type": "tool_call", "data": {**tool_call_data, "status": "pending"}}

        tool_data = tools_dict[tool_id]
        action_data = (
            tool_data["config"]["actions"][action_name]
            if tool_data["name"] == "api_tool"
            else next(
                action
                for action in tool_data["actions"]
                if action["name"] == action_name
            )
        )

        query_params, headers, body, parameters = {}, {}, {}, {}
        param_types = {
            "query_params": query_params,
            "headers": headers,
            "body": body,
            "parameters": parameters,
        }

        for param_type, target_dict in param_types.items():
            if param_type in action_data and action_data[param_type].get("properties"):
                for param, details in action_data[param_type]["properties"].items():
                    if param not in call_args and "value" in details:
                        target_dict[param] = details["value"]
        for param, value in call_args.items():
            for param_type, target_dict in param_types.items():
                if param_type in action_data and param in action_data[param_type].get(
                    "properties", {}
                ):
                    target_dict[param] = value
        tm = ToolManager(config={})

        # Prepare tool_config and add tool_id for memory tools
        if tool_data["name"] == "api_tool":
            tool_config = {
                "url": tool_data["config"]["actions"][action_name]["url"],
                "method": tool_data["config"]["actions"][action_name]["method"],
                "headers": headers,
                "query_params": query_params,
            }
        else:
            tool_config = tool_data["config"].copy() if tool_data["config"] else {}
            # Add tool_id from MongoDB _id for tools that need instance isolation (like memory tool)
            # Use MongoDB _id if available, otherwise fall back to enumerated tool_id
            tool_config["tool_id"] = str(tool_data.get("_id", tool_id))

        tool = tm.load_tool(
            tool_data["name"],
            tool_config=tool_config,
            user_id=self.user,  # Pass user ID for MCP tools credential decryption
        )
        if tool_data["name"] == "api_tool":
            print(
                f"Executing api: {action_name} with query_params: {query_params}, headers: {headers}, body: {body}"
            )
            result = tool.execute_action(action_name, **body)
        else:
            print(f"Executing tool: {action_name} with args: {call_args}")
            result = tool.execute_action(action_name, **parameters)
        tool_call_data["result"] = (
            f"{str(result)[:50]}..." if len(str(result)) > 50 else result
        )

        yield {"type": "tool_call", "data": {**tool_call_data, "status": "completed"}}
        self.tool_calls.append(tool_call_data)

        return result, call_id
```

**File:** application/agents/base.py (L325-335)

```python
    def _retriever_search(
        self,
        retriever: BaseRetriever,
        query: str,
        log_context: Optional[LogContext] = None,
    ) -> List[Dict]:
        retrieved_data = retriever.search(query)
        if log_context:
            data = build_stack_data(retriever, exclude_attributes=["llm"])
            log_context.stacks.append({"component": "retriever", "data": data})
        return retrieved_data
```

**File:** application/agents/base.py (L368-382)

```python
    def _llm_handler(
        self,
        resp,
        tools_dict: Dict,
        messages: List[Dict],
        log_context: Optional[LogContext] = None,
        attachments: Optional[List[Dict]] = None,
    ):
        resp = self.llm_handler.process_message_flow(
            self, resp, tools_dict, messages, attachments, True
        )
        if log_context:
            data = build_stack_data(self.llm_handler, exclude_attributes=["tool_calls"])
            log_context.stacks.append({"component": "llm_handler", "data": data})
        return resp
```

**File:** application/agents/classic_agent.py (L10-53)

```python
class ClassicAgent(BaseAgent):
    """A simplified agent with clear execution flow.

    Usage:
    1. Processes a query through retrieval
    2. Sets up available tools
    3. Generates responses using LLM
    4. Handles tool interactions if needed
    5. Returns standardized outputs

    Easy to extend by overriding specific steps.
    """

    def _gen_inner(
        self, query: str, retriever: BaseRetriever, log_context: LogContext
    ) -> Generator[Dict, None, None]:
        # Step 1: Retrieve relevant data
        retrieved_data = self._retriever_search(retriever, query, log_context)

        # Step 2: Prepare tools
        tools_dict = (
            self._get_user_tools(self.user)
            if not self.user_api_key
            else self._get_tools(self.user_api_key)
        )
        self._prepare_tools(tools_dict)

        # Step 3: Build and process messages
        messages = self._build_messages(self.prompt, query, retrieved_data)
        llm_response = self._llm_gen(messages, log_context)

        # Step 4: Handle the response
        yield from self._handle_response(
            llm_response, tools_dict, messages, log_context
        )

        # Step 5: Return metadata
        yield {"sources": retrieved_data}
        yield {"tool_calls": self._get_truncated_tool_calls()}

        # Log tool calls for debugging
        log_context.stacks.append(
            {"component": "agent", "data": {"tool_calls": self.tool_calls.copy()}}
        )
```

**File:** application/agents/tools/tool_manager.py (L9-24)

```python
class ToolManager:
    def __init__(self, config):
        self.config = config
        self.tools = {}
        self.load_tools()

    def load_tools(self):
        tools_dir = os.path.join(os.path.dirname(__file__))
        for finder, name, ispkg in pkgutil.iter_modules([tools_dir]):
            if name == "base" or name.startswith("__"):
                continue
            module = importlib.import_module(f"application.agents.tools.{name}")
            for member_name, obj in inspect.getmembers(module, inspect.isclass):
                if issubclass(obj, Tool) and obj is not Tool:
                    tool_config = self.config.get(name, {})
                    self.tools[name] = obj(tool_config)
```

**File:** application/agents/tools/tool_manager.py (L26-34)

```python
    def load_tool(self, tool_name, tool_config, user_id=None):
        self.config[tool_name] = tool_config
        module = importlib.import_module(f"application.agents.tools.{tool_name}")
        for member_name, obj in inspect.getmembers(module, inspect.isclass):
            if issubclass(obj, Tool) and obj is not Tool:
                if tool_name in {"mcp_tool", "notes", "memory", "todo_list"} and user_id:
                    return obj(tool_config, user_id)
                else:
                    return obj(tool_config)
```

**File:** application/api/user/agents/routes.py (L33-98)

```python
@agents_ns.route("/get_agent")
class GetAgent(Resource):
    @api.doc(params={"id": "Agent ID"}, description="Get agent by ID")
    def get(self):
        if not (decoded_token := request.decoded_token):
            return {"success": False}, 401
        if not (agent_id := request.args.get("id")):
            return {"success": False, "message": "ID required"}, 400
        try:
            agent = agents_collection.find_one(
                {"_id": ObjectId(agent_id), "user": decoded_token["sub"]}
            )
            if not agent:
                return {"status": "Not found"}, 404
            data = {
                "id": str(agent["_id"]),
                "name": agent["name"],
                "description": agent.get("description", ""),
                "image": (
                    generate_image_url(agent["image"]) if agent.get("image") else ""
                ),
                "source": (
                    str(source_doc["_id"])
                    if isinstance(agent.get("source"), DBRef)
                    and (source_doc := db.dereference(agent.get("source")))
                    else ""
                ),
                "sources": [
                    (
                        str(db.dereference(source_ref)["_id"])
                        if isinstance(source_ref, DBRef) and db.dereference(source_ref)
                        else source_ref
                    )
                    for source_ref in agent.get("sources", [])
                    if (isinstance(source_ref, DBRef) and db.dereference(source_ref))
                    or source_ref == "default"
                ],
                "chunks": agent["chunks"],
                "retriever": agent.get("retriever", ""),
                "prompt_id": agent.get("prompt_id", ""),
                "tools": agent.get("tools", []),
                "tool_details": resolve_tool_details(agent.get("tools", [])),
                "agent_type": agent.get("agent_type", ""),
                "status": agent.get("status", ""),
                "json_schema": agent.get("json_schema"),
                "limited_token_mode": agent.get("limited_token_mode", False),
                "token_limit": agent.get("token_limit", settings.DEFAULT_AGENT_LIMITS["token_limit"]),
                "limited_request_mode": agent.get("limited_request_mode", False),
                "request_limit": agent.get("request_limit", settings.DEFAULT_AGENT_LIMITS["request_limit"]),
                "created_at": agent.get("createdAt", ""),
                "updated_at": agent.get("updatedAt", ""),
                "last_used_at": agent.get("lastUsedAt", ""),
                "key": (
                    f"{agent['key'][:4]}...{agent['key'][-4:]}"
                    if "key" in agent
                    else ""
                ),
                "pinned": agent.get("pinned", False),
                "shared": agent.get("shared_publicly", False),
                "shared_metadata": agent.get("shared_metadata", {}),
                "shared_token": agent.get("shared_token", ""),
            }
            return make_response(jsonify(data), 200)
        except Exception as e:
            current_app.logger.error(f"Agent fetch error: {e}", exc_info=True)
            return {"success": False}, 400
```

**File:** application/api/answer/services/stream_processor.py (L56-90)

```python
class StreamProcessor:
    def __init__(
        self, request_data: Dict[str, Any], decoded_token: Optional[Dict[str, Any]]
    ):
        mongo = MongoDB.get_client()
        self.db = mongo[settings.MONGO_DB_NAME]
        self.agents_collection = self.db["agents"]
        self.attachments_collection = self.db["attachments"]
        self.prompts_collection = self.db["prompts"]

        self.data = request_data
        self.decoded_token = decoded_token
        self.initial_user_id = (
            self.decoded_token.get("sub") if self.decoded_token is not None else None
        )
        self.conversation_id = self.data.get("conversation_id")
        self.source = {}
        self.all_sources = []
        self.attachments = []
        self.history = []
        self.agent_config = {}
        self.retriever_config = {}
        self.is_shared_usage = False
        self.shared_token = None
        self.gpt_model = get_gpt_model()
        self.conversation_service = ConversationService()

    def initialize(self):
        """Initialize all required components for processing"""
        self._configure_agent()
        self._configure_source()
        self._configure_retriever()
        self._configure_agent()
        self._load_conversation_history()
        self._process_attachments()
```

**File:** application/api/answer/services/stream_processor.py (L137-164)

```python
    def _get_agent_key(self, agent_id: Optional[str], user_id: Optional[str]) -> tuple:
        """Get API key for agent with access control"""
        if not agent_id:
            return None, False, None
        try:
            agent = self.agents_collection.find_one({"_id": ObjectId(agent_id)})
            if agent is None:
                raise Exception("Agent not found")
            is_owner = agent.get("user") == user_id
            is_shared_with_user = agent.get(
                "shared_publicly", False
            ) or user_id in agent.get("shared_with", [])

            if not (is_owner or is_shared_with_user):
                raise Exception("Unauthorized access to the agent")
            if is_owner:
                self.agents_collection.update_one(
                    {"_id": ObjectId(agent_id)},
                    {
                        "$set": {
                            "lastUsedAt": datetime.datetime.now(datetime.timezone.utc)
                        }
                    },
                )
            return str(agent["key"]), not is_owner, agent.get("shared_token")
        except Exception as e:
            logger.error(f"Error in get_agent_key: {str(e)}", exc_info=True)
            raise
```

**File:** application/api/answer/services/stream_processor.py (L325-353)

```python
    def create_agent(self):
        """Create and return the configured agent"""
        return AgentCreator.create_agent(
            self.agent_config["agent_type"],
            endpoint="stream",
            llm_name=settings.LLM_PROVIDER,
            gpt_model=self.gpt_model,
            api_key=settings.API_KEY,
            user_api_key=self.agent_config["user_api_key"],
            prompt=get_prompt(self.agent_config["prompt_id"], self.prompts_collection),
            chat_history=self.history,
            decoded_token=self.decoded_token,
            attachments=self.attachments,
            json_schema=self.agent_config.get("json_schema"),
        )

    def create_retriever(self):
        """Create and return the configured retriever"""
        return RetrieverCreator.create_retriever(
            self.retriever_config["retriever_name"],
            source=self.source,
            chat_history=self.history,
            prompt=get_prompt(self.agent_config["prompt_id"], self.prompts_collection),
            chunks=self.retriever_config["chunks"],
            token_limit=self.retriever_config["token_limit"],
            gpt_model=self.gpt_model,
            user_api_key=self.agent_config["user_api_key"],
            decoded_token=self.decoded_token,
        )
```

**File:** application/llm/handlers/base.py (L68-98)

```python
    def process_message_flow(
        self,
        agent,
        initial_response,
        tools_dict: Dict,
        messages: List[Dict],
        attachments: Optional[List] = None,
        stream: bool = False,
    ) -> Union[str, Generator]:
        """
        Main orchestration method for processing LLM message flow.

        Args:
            agent: The agent instance
            initial_response: Initial LLM response
            tools_dict: Dictionary of available tools
            messages: Conversation history
            attachments: Optional attachments
            stream: Whether to use streaming

        Returns:
            Final response or generator for streaming
        """
        messages = self.prepare_messages(agent, messages, attachments)

        if stream:
            return self.handle_streaming(agent, initial_response, tools_dict, messages)
        else:
            return self.handle_non_streaming(
                agent, initial_response, tools_dict, messages
            )
```

**File:** application/api/answer/routes/base.py (L44-124)

```python
    def check_usage(
            self, agent_config: Dict
    ) -> Optional[Response]:
        """Check if there is a usage limit and if it is exceeded

        Args:
            agent_config: The config dict of agent instance

        Returns:
            None or Response if either of limits exceeded.

        """
        api_key = agent_config.get("user_api_key")
        if not api_key:
            return None

        agents_collection = self.db["agents"]
        agent = agents_collection.find_one({"key": api_key})

        if not agent:
            return make_response(
                jsonify(
                    {
                        "success": False,
                        "message": "Invalid API key."
                    }
                ),
                401
            )

        limited_token_mode = agent.get("limited_token_mode", False)
        limited_request_mode = agent.get("limited_request_mode", False)
        token_limit = int(agent.get("token_limit", settings.DEFAULT_AGENT_LIMITS["token_limit"]))
        request_limit = int(agent.get("request_limit", settings.DEFAULT_AGENT_LIMITS["request_limit"]))

        token_usage_collection = self.db["token_usage"]

        end_date = datetime.datetime.now()
        start_date = end_date - datetime.timedelta(hours=24)

        match_query = {
            "timestamp": {"$gte": start_date, "$lte": end_date},
            "api_key": api_key
        }

        if limited_token_mode:
            token_pipeline = [
                {"$match": match_query},
                {
                    "$group": {
                        "_id": None,
                        "total_tokens": {"$sum": {"$add": ["$prompt_tokens", "$generated_tokens"]}}
                    }
                }
            ]
            token_result = list(token_usage_collection.aggregate(token_pipeline))
            daily_token_usage = token_result[0]["total_tokens"] if token_result else 0
        else:
            daily_token_usage = 0

        if limited_request_mode:
            daily_request_usage = token_usage_collection.count_documents(match_query)
        else:
            daily_request_usage = 0

        if not limited_token_mode and not limited_request_mode:
            return None
        elif limited_token_mode and token_limit > daily_token_usage:
            return None
        elif limited_request_mode and request_limit > daily_request_usage:
            return None

        return make_response(
            jsonify(
                {
                    "success": False,
                    "message": "Exceeding usage limit, please try again later."
                }
            ),
            429, # too many requests
        )
```

**File:** application/api/answer/routes/base.py (L126-278)

```python
    def complete_stream(
        self,
        question: str,
        agent: Any,
        retriever: Any,
        conversation_id: Optional[str],
        user_api_key: Optional[str],
        decoded_token: Dict[str, Any],
        isNoneDoc: bool = False,
        index: Optional[int] = None,
        should_save_conversation: bool = True,
        attachment_ids: Optional[List[str]] = None,
        agent_id: Optional[str] = None,
        is_shared_usage: bool = False,
        shared_token: Optional[str] = None,
    ) -> Generator[str, None, None]:
        """
        Generator function that streams the complete conversation response.

        Args:
            question: The user's question
            agent: The agent instance
            retriever: The retriever instance
            conversation_id: Existing conversation ID
            user_api_key: User's API key if any
            decoded_token: Decoded JWT token
            isNoneDoc: Flag for document-less responses
            index: Index of message to update
            should_save_conversation: Whether to persist the conversation
            attachment_ids: List of attachment IDs
            agent_id: ID of agent used
            is_shared_usage: Flag for shared agent usage
            shared_token: Token for shared agent

        Yields:
            Server-sent event strings
        """
        try:
            response_full, thought, source_log_docs, tool_calls = "", "", [], []
            is_structured = False
            schema_info = None
            structured_chunks = []

            for line in agent.gen(query=question, retriever=retriever):
                if "answer" in line:
                    response_full += str(line["answer"])
                    if line.get("structured"):
                        is_structured = True
                        schema_info = line.get("schema")
                        structured_chunks.append(line["answer"])
                    else:
                        data = json.dumps({"type": "answer", "answer": line["answer"]})
                        yield f"data: {data}\n\n"
                elif "sources" in line:
                    truncated_sources = []
                    source_log_docs = line["sources"]
                    for source in line["sources"]:
                        truncated_source = source.copy()
                        if "text" in truncated_source:
                            truncated_source["text"] = (
                                truncated_source["text"][:100].strip() + "..."
                            )
                        truncated_sources.append(truncated_source)
                    if truncated_sources:
                        data = json.dumps(
                            {"type": "source", "source": truncated_sources}
                        )
                        yield f"data: {data}\n\n"
                elif "tool_calls" in line:
                    tool_calls = line["tool_calls"]
                    data = json.dumps({"type": "tool_calls", "tool_calls": tool_calls})
                    yield f"data: {data}\n\n"
                elif "thought" in line:
                    thought += line["thought"]
                    data = json.dumps({"type": "thought", "thought": line["thought"]})
                    yield f"data: {data}\n\n"
                elif "type" in line:
                    data = json.dumps(line)
                    yield f"data: {data}\n\n"

            if is_structured and structured_chunks:
                structured_data = {
                    "type": "structured_answer",
                    "answer": response_full,
                    "structured": True,
                    "schema": schema_info,
                }
                data = json.dumps(structured_data)
                yield f"data: {data}\n\n"

            if isNoneDoc:
                for doc in source_log_docs:
                    doc["source"] = "None"
            llm = LLMCreator.create_llm(
                settings.LLM_PROVIDER,
                api_key=settings.API_KEY,
                user_api_key=user_api_key,
                decoded_token=decoded_token,
            )

            if should_save_conversation:
                conversation_id = self.conversation_service.save_conversation(
                    conversation_id,
                    question,
                    response_full,
                    thought,
                    source_log_docs,
                    tool_calls,
                    llm,
                    self.gpt_model,
                    decoded_token,
                    index=index,
                    api_key=user_api_key,
                    agent_id=agent_id,
                    is_shared_usage=is_shared_usage,
                    shared_token=shared_token,
                    attachment_ids=attachment_ids,
                )
            else:
                conversation_id = None
            id_data = {"type": "id", "id": str(conversation_id)}
            data = json.dumps(id_data)
            yield f"data: {data}\n\n"

            retriever_params = retriever.get_params()
            log_data = {
                "action": "stream_answer",
                "level": "info",
                "user": decoded_token.get("sub"),
                "api_key": user_api_key,
                "question": question,
                "response": response_full,
                "sources": source_log_docs,
                "retriever_params": retriever_params,
                "attachments": attachment_ids,
                "timestamp": datetime.datetime.now(datetime.timezone.utc),
            }
            if is_structured:
                log_data["structured_output"] = True
                if schema_info:
                    log_data["schema"] = schema_info

            # clean up text fields to be no longer than 10000 characters
            for key, value in log_data.items():
                if isinstance(value, str) and len(value) > 10000:
                    log_data[key] = value[:10000]

            self.user_logs_collection.insert_one(log_data)

            # End of stream

            data = json.dumps({"type": "end"})
            yield f"data: {data}\n\n"
```

**File:** application/agents/react_agent.py (L27-31)

```python
class ReActAgent(BaseAgent):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.plan: str = ""
        self.observations: List[str] = []
```

**File:** application/agents/react_agent.py (L108-224)

```python
    def _gen_inner(
        self, query: str, retriever: BaseRetriever, log_context: LogContext
    ) -> Generator[Dict, None, None]:
        # Reset state for this generation call
        self.plan = ""
        self.observations = []
        retrieved_data = self._retriever_search(retriever, query, log_context)

        if self.user_api_key:
            tools_dict = self._get_tools(self.user_api_key)
        else:
            tools_dict = self._get_user_tools(self.user)
        self._prepare_tools(tools_dict)

        docs_together = "\n".join([doc["text"] for doc in retrieved_data])
        iterating_reasoning = 0
        while iterating_reasoning < MAX_ITERATIONS_REASONING:
            iterating_reasoning += 1
            # 1. Create Plan
            logger.info("ReActAgent: Creating plan...")
            plan_stream = self._create_plan(query, docs_together, log_context)
            current_plan_parts = []
            yield {"thought": f"Reasoning... (iteration {iterating_reasoning})\n\n"}
            for line_chunk in plan_stream:
                current_plan_parts.append(line_chunk)
                yield {"thought": line_chunk}
            self.plan = "".join(current_plan_parts)
            if self.plan:
                self.observations.append(
                    f"Plan: {self.plan} Iteration: {iterating_reasoning}"
                )

            max_obs_len = 20000
            obs_str = "\n".join(self.observations)
            if len(obs_str) > max_obs_len:
                obs_str = obs_str[:max_obs_len] + "\n...[observations truncated]"
            execution_prompt_str = (
                (self.prompt or "")
                + f"\n\nFollow this plan:\n{self.plan}"
                + f"\n\nObservations:\n{obs_str}"
                + f"\n\nIf there is enough data to complete user query '{query}', Respond with 'SATISFIED' only. Otherwise, continue. Dont Menstion 'SATISFIED' in your response if you are not ready. "
            )

            messages = self._build_messages(execution_prompt_str, query, retrieved_data)

            resp_from_llm_gen = self._llm_gen(messages, log_context)

            initial_llm_thought_content = self._extract_content_from_llm_response(
                resp_from_llm_gen
            )
            if initial_llm_thought_content:
                self.observations.append(
                    f"Initial thought/response: {initial_llm_thought_content}"
                )
            else:
                logger.info(
                    "ReActAgent: Initial LLM response (before handler) had no textual content (might be only tool calls)."
                )
            resp_after_handler = self._llm_handler(
                resp_from_llm_gen, tools_dict, messages, log_context
            )

            for (
                tool_call_info
            ) in (
                self.tool_calls
            ):  # Iterate over self.tool_calls populated by _llm_handler
                observation_string = (
                    f"Executed Action: Tool '{tool_call_info.get('tool_name', 'N/A')}' "
                    f"with arguments '{tool_call_info.get('arguments', '{}')}'. Result: '{str(tool_call_info.get('result', ''))[:200]}...'"
                )
                self.observations.append(observation_string)

            content_after_handler = self._extract_content_from_llm_response(
                resp_after_handler
            )
            if content_after_handler:
                self.observations.append(
                    f"Response after tool execution: {content_after_handler}"
                )
            else:
                logger.info(
                    "ReActAgent: LLM response after handler had no textual content."
                )

            if log_context:
                log_context.stacks.append(
                    {
                        "component": "agent_tool_calls",
                        "data": {"tool_calls": self.tool_calls.copy()},
                    }
                )

            yield {"sources": retrieved_data}

            display_tool_calls = []
            for tc in self.tool_calls:
                cleaned_tc = tc.copy()
                if len(str(cleaned_tc.get("result", ""))) > 50:
                    cleaned_tc["result"] = str(cleaned_tc["result"])[:50] + "..."
                display_tool_calls.append(cleaned_tc)
            if display_tool_calls:
                yield {"tool_calls": display_tool_calls}

            if "SATISFIED" in content_after_handler:
                logger.info(
                    "ReActAgent: LLM satisfied with the plan and data. Stopping reasoning."
                )
                break

        # 3. Create Final Answer based on all observations
        final_answer_stream = self._create_final_answer(
            query, self.observations, log_context
        )
        for answer_chunk in final_answer_stream:
            yield {"answer": answer_chunk}
        logger.info("ReActAgent: Finished generating final answer.")
```

**File:** application/worker.py (L147-212)

```python
def run_agent_logic(agent_config, input_data):
    try:
        source = agent_config.get("source")
        retriever = agent_config.get("retriever", "classic")
        if isinstance(source, DBRef):
            source_doc = db.dereference(source)
            source = str(source_doc["_id"])
            retriever = source_doc.get("retriever", agent_config.get("retriever"))
        else:
            source = {}
        source = {"active_docs": source}
        chunks = int(agent_config.get("chunks", 2))
        prompt_id = agent_config.get("prompt_id", "default")
        user_api_key = agent_config["key"]
        agent_type = agent_config.get("agent_type", "classic")
        decoded_token = {"sub": agent_config.get("user")}
        prompt = get_prompt(prompt_id, db["prompts"])
        agent = AgentCreator.create_agent(
            agent_type,
            endpoint="webhook",
            llm_name=settings.LLM_PROVIDER,
            gpt_model=settings.LLM_NAME,
            api_key=settings.API_KEY,
            user_api_key=user_api_key,
            prompt=prompt,
            chat_history=[],
            decoded_token=decoded_token,
            attachments=[],
        )
        retriever = RetrieverCreator.create_retriever(
            retriever,
            source=source,
            chat_history=[],
            prompt=prompt,
            chunks=chunks,
            token_limit=settings.DEFAULT_MAX_HISTORY,
            gpt_model=settings.LLM_NAME,
            user_api_key=user_api_key,
            decoded_token=decoded_token,
        )
        answer = agent.gen(query=input_data, retriever=retriever)
        response_full = ""
        thought = ""
        source_log_docs = []
        tool_calls = []

        for line in answer:
            if "answer" in line:
                response_full += str(line["answer"])
            elif "sources" in line:
                source_log_docs.extend(line["sources"])
            elif "tool_calls" in line:
                tool_calls.extend(line["tool_calls"])
            elif "thought" in line:
                thought += line["thought"]
        result = {
            "answer": response_full,
            "sources": source_log_docs,
            "tool_calls": tool_calls,
            "thought": thought,
        }
        logging.info(f"Agent response: {result}")
        return result
    except Exception as e:
        logging.error(f"Error in run_agent_logic: {e}", exc_info=True)
        raise
```

**File:** application/worker.py (L218-361)

```python
def ingest_worker(
    self, directory, formats, job_name, file_path, filename, user, retriever="classic"
):
    """
    Ingest and process documents.

    Args:
        self: Reference to the instance of the task.
        directory (str): Specifies the directory for ingesting ('inputs' or 'temp').
        formats (list of str): List of file extensions to consider for ingestion (e.g., [".rst", ".md"]).
        job_name (str): Name of the job for this ingestion task (original, unsanitized).
        file_path (str): Complete file path to use consistently throughout the pipeline.
        filename (str): Original unsanitized filename provided by the user.
        user (str): Identifier for the user initiating the ingestion (original, unsanitized).
        retriever (str): Type of retriever to use for processing the documents.

    Returns:
        dict: Information about the completed ingestion task, including input parameters and a "limited" flag.
    """
    input_files = None
    recursive = True
    limit = None
    exclude = True
    sample = False

    storage = StorageCreator.get_storage()

    logging.info(f"Ingest path: {file_path}", extra={"user": user, "job": job_name})

    # Create temporary working directory

    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            os.makedirs(temp_dir, exist_ok=True)

            if storage.is_directory(file_path):
                # Handle directory case
                logging.info(f"Processing directory: {file_path}")
                files_list = storage.list_files(file_path)

                for storage_file_path in files_list:
                    if storage.is_directory(storage_file_path):
                        continue

                    # Create relative path structure in temp directory
                    rel_path = os.path.relpath(storage_file_path, file_path)
                    local_file_path = os.path.join(temp_dir, rel_path)

                    os.makedirs(os.path.dirname(local_file_path), exist_ok=True)

                    # Download file
                    try:
                        file_data = storage.get_file(storage_file_path)
                        with open(local_file_path, "wb") as f:
                            f.write(file_data.read())
                    except Exception as e:
                        logging.error(
                            f"Error downloading file {storage_file_path}: {e}"
                        )
                        continue
            else:
                # Handle single file case
                temp_filename = os.path.basename(file_path)
                temp_file_path = os.path.join(temp_dir, temp_filename)

                file_data = storage.get_file(file_path)
                with open(temp_file_path, "wb") as f:
                    f.write(file_data.read())

                # Handle zip files
                if temp_filename.endswith(".zip"):
                    logging.info(f"Extracting zip file: {temp_filename}")
                    extract_zip_recursive(
                        temp_file_path,
                        temp_dir,
                        current_depth=0,
                        max_depth=RECURSION_DEPTH,
                    )

            self.update_state(state="PROGRESS", meta={"current": 1})
            if sample:
                logging.info(f"Sample mode enabled. Using {limit} documents.")
            reader = SimpleDirectoryReader(
                input_dir=temp_dir,
                input_files=input_files,
                recursive=recursive,
                required_exts=formats,
                exclude_hidden=exclude,
                file_metadata=metadata_from_filename,
            )
            raw_docs = reader.load_data()

            directory_structure = getattr(reader, "directory_structure", {})
            logging.info(f"Directory structure from reader: {directory_structure}")

            chunker = Chunker(
                chunking_strategy="classic_chunk",
                max_tokens=MAX_TOKENS,
                min_tokens=MIN_TOKENS,
                duplicate_headers=False,
            )
            raw_docs = chunker.chunk(documents=raw_docs)

            docs = [Document.to_langchain_format(raw_doc) for raw_doc in raw_docs]

            id = ObjectId()

            vector_store_path = os.path.join(temp_dir, "vector_store")
            os.makedirs(vector_store_path, exist_ok=True)

            embed_and_store_documents(docs, vector_store_path, id, self)

            tokens = count_tokens_docs(docs)

            self.update_state(state="PROGRESS", meta={"current": 100})

            if sample:
                for i in range(min(5, len(raw_docs))):
                    logging.info(f"Sample document {i}: {raw_docs[i]}")
            file_data = {
                "name": job_name,
                "file": filename,
                "user": user,
                "tokens": tokens,
                "retriever": retriever,
                "id": str(id),
                "type": "local",
                "file_path": file_path,
                "directory_structure": json.dumps(directory_structure),
            }

            upload_index(vector_store_path, file_data)
        except Exception as e:
            logging.error(f"Error in ingest_worker: {e}", exc_info=True)
            raise
    return {
        "directory": directory,
        "formats": formats,
        "name_job": job_name,  # Use original job_name
        "filename": filename,
        "user": user,  # Use original user
        "limited": False,
    }

```

**File:** application/retriever/base.py (L4-14)

```python
class BaseRetriever(ABC):
    def __init__(self):
        pass

    @abstractmethod
    def search(self, *args, **kwargs):
        pass

    @abstractmethod
    def get_params(self):
        pass
```

**File:** application/agents/tools/base.py (L4-21)

```python
class Tool(ABC):
    @abstractmethod
    def execute_action(self, action_name: str, **kwargs):
        pass

    @abstractmethod
    def get_actions_metadata(self):
        """
        Returns a list of JSON objects describing the actions supported by the tool.
        """
        pass

    @abstractmethod
    def get_config_requirements(self):
        """
        Returns a dictionary describing the configuration requirements for the tool.
        """
        pass
```
