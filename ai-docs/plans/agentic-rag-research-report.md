# Agentic RAG: Comprehensive Research Report

**Created:** 2025-01-21
**Status:** Research Complete
**Purpose:** Deep research into agentic RAG patterns to inform implementation in browser-based React SPA

---

## Executive Summary

**Agentic RAG** represents a paradigm shift from traditional static retrieval-augmented generation to dynamic, reasoning-enabled systems where AI agents actively orchestrate retrieval, reflection, and generation workflows. Instead of simple "query → retrieve → generate" pipelines, agentic RAG employs autonomous agents that **plan, reason, self-correct, and use tools** to iteratively refine retrieval and improve answer quality.

**Key Insight for Our Application:**
Our current browser-based RAG app (React + PGlite + pgvector + hybrid search) has the **foundational infrastructure** for agentic RAG but lacks the **agent layer**: planning, tool calling, reflection loops, and adaptive retrieval strategies.

**Critical Finding:**
Agentic RAG can be implemented **entirely client-side** using OpenAI's function calling API for tool orchestration, Web Workers for background processing, and IndexedDB for persistence—perfectly aligned with our zero-backend architecture.

---

## 1. What is Agentic RAG?

### Definition

> **Agentic RAG** is the use of AI agents to facilitate retrieval-augmented generation. Agentic RAG systems add AI agents to the RAG pipeline to increase adaptability and accuracy through autonomous decision-making, multi-step reasoning, and dynamic retrieval management.

### Evolution from Traditional RAG

**Traditional RAG (Static):**
- Linear workflow: User query → Vector search → Context injection → LLM generation
- Single-pass retrieval
- No self-assessment of retrieval quality
- Fixed strategy regardless of query complexity

**Agentic RAG (Dynamic):**
- Iterative workflow with feedback loops
- Agents **reason** about what information is needed
- Agents **plan** multi-step retrieval strategies
- Agents **reflect** on retrieval quality and **self-correct**
- Agents **use tools** beyond just vector search (web search, SQL, APIs)
- Adaptive strategy selection based on query complexity

### Core Principles

1. **Autonomy**: Agents decide when and how to retrieve information
2. **Reasoning**: Agents analyze queries, decompose complexity, evaluate relevance
3. **Planning**: Multi-step workflows decomposed into subtasks
4. **Reflection**: Self-critique of retrieval quality and generated answers
5. **Tool Use**: Dynamic selection and execution of multiple tools
6. **Adaptation**: Strategy changes based on real-time feedback

---

## 2. Traditional RAG vs Agentic RAG: Comparative Analysis

| Dimension | Traditional RAG | Agentic RAG |
|-----------|----------------|-------------|
| **Workflow** | Linear: query → retrieve → generate | Iterative: plan → retrieve → evaluate → refine → generate |
| **Intelligence** | Retrieval-focused | Reasoning-integrated |
| **Retrieval Strategy** | Fixed (always retrieve) | Adaptive (retrieve only when needed) |
| **Query Handling** | Single-pass | Multi-step with decomposition |
| **Quality Control** | None (trusts retrieval blindly) | Reflection + self-correction |
| **Tool Access** | Single retriever (vector search) | Multiple tools (search, SQL, APIs, web) |
| **Failure Handling** | Returns poor answer if retrieval fails | Rewrites query, tries alternate tools |
| **Complexity Management** | Treats all queries equally | Classifies complexity, routes accordingly |
| **Speed** | Faster (single pass) | Slower (iterative refinement) |
| **Cost** | Lower (fewer LLM calls) | Higher (planning + reflection + generation) |
| **Accuracy** | Good for simple queries | Excellent for complex, multi-faceted queries |
| **Use Cases** | FAQ, simple Q&A, known-domain lookups | Research, analysis, code debugging, complex reasoning |

### When to Use Each

**Traditional RAG:**
- Simple factual questions
- Well-defined knowledge domains
- Speed/cost critical
- Predictable query patterns

**Agentic RAG:**
- Complex research queries
- Multi-source information synthesis
- Uncertain retrieval quality
- Reasoning-intensive tasks
- Code generation/debugging
- Asynchronous workflows

---

## 3. Seven Agentic RAG Architecture Patterns

### Pattern 1: Agentic RAG Routers

**Concept:** Intelligent query routing to appropriate retrieval tools.

**How It Works:**
1. User submits query
2. **Router Agent** analyzes query intent and information requirements
3. Agent selects optimal tool(s): vector search, web search, SQL database, API
4. Routes query to selected tool(s)
5. Aggregates results from multiple sources if needed
6. LLM synthesizes final answer

**Key Components:**
- **Retrieval Agent**: Coordination unit managing routing logic
- **Router**: Decision-maker evaluating query→tool fitness
- **Tools**: Vector search, web search, text-to-SQL, recommendation systems
- **Data Sources**: Structured DBs, unstructured docs, external APIs

**Implementation Approach:**
```typescript
// Pseudo-code for router pattern
interface Tool {
  name: string;
  description: string;
  execute: (query: string) => Promise<Result[]>;
}

async function routerAgent(query: string, tools: Tool[]) {
  // LLM decides which tool(s) to use
  const selectedTools = await llm.selectTools(query, tools);

  // Execute tools in parallel or sequence
  const results = await Promise.all(
    selectedTools.map(tool => tool.execute(query))
  );

  // Synthesize results
  return await llm.synthesize(query, results);
}
```

**When to Use:**
- Multi-source environments (docs + web + DB)
- Query types requiring different retrieval strategies
- Systems with 3+ distinct data sources

**Complexity:**
- **Simple:** Single router, 2-3 tools
- **Complex:** Multiple specialized routers, 5+ tools, cascading decisions

---

### Pattern 2: Query Planning Agentic RAG

**Concept:** Decompose complex queries into parallelizable subqueries.

**How It Works:**
1. **Query Planner** receives complex question
2. Planner generates execution plan: list of subqueries/subtasks
3. Each subquery routes to specialized RAG pipeline
4. Pipelines execute in parallel (where possible) or sequence (where dependent)
5. **Synthesis Agent** combines partial answers into coherent response

**Key Components:**
- **Query Planner**: LLM-based orchestrator creating execution plans
- **RAG Pipelines**: Specialized query engines for different domains/sources
- **Synthesis Engine**: LLM combining retrieved information
- **Dependency Tracker**: Manages sequential vs parallel execution

**Example:**
```
User Query: "Compare revenue growth of tech companies in 2024 vs AI startups"

Query Plan:
1. Subquery 1: "Revenue growth of major tech companies in 2024" → Financial DB
2. Subquery 2: "Revenue data for AI startups in 2024" → Startup DB
3. Subquery 3: "Industry benchmarks for tech sector 2024" → Vector search
4. Synthesis: Compare all results, identify trends, generate comparative analysis
```

**Implementation Approach:**
```typescript
async function queryPlanningRAG(complexQuery: string) {
  // Step 1: Generate plan
  const plan = await llm.generatePlan(complexQuery);
  // plan = [
  //   { subquery: "...", tool: "vectorSearch", parallel: true },
  //   { subquery: "...", tool: "sqlDB", parallel: true },
  //   { subquery: "...", tool: "webSearch", parallel: false, dependsOn: [0,1] }
  // ]

  // Step 2: Execute parallel groups
  const results = [];
  for (const step of plan) {
    if (step.parallel) {
      results.push(await executeInParallel(step));
    } else {
      results.push(await executeSequential(step, results));
    }
  }

  // Step 3: Synthesize
  return await llm.synthesize(complexQuery, results);
}
```

**When to Use:**
- Multi-faceted questions requiring information from diverse sources
- Comparative analysis tasks
- Research queries needing evidence from multiple domains

**Benefits:**
- Parallelization improves speed
- Modular architecture simplifies debugging
- Each pipeline can be optimized independently

---

### Pattern 3: Adaptive RAG

**Concept:** Dynamic strategy selection based on query complexity classification.

**How It Works:**
1. **Complexity Classifier** analyzes incoming query
2. Classifier categorizes query: Straightforward / Simple / Complex
3. System routes to appropriate strategy:
   - **Straightforward**: No retrieval (LLM has knowledge) → Direct generation
   - **Simple**: Single-step RAG → Retrieve once, generate answer
   - **Complex**: Multi-step RAG → Iterative retrieval with reflection
4. Execute selected strategy
5. Return answer

**Key Components:**
- **Query Classifier**: Lightweight model predicting complexity
- **Three Execution Paths**:
  - Path A: LLM-only (no retrieval)
  - Path B: Standard RAG (single retrieval)
  - Path C: Agentic RAG (multi-step with reflection)
- **Complexity Signals**: Query length, ambiguity, domain specificity, question type

**Classification Examples:**
```
Straightforward: "What is the capital of France?" → No retrieval
Simple: "Summarize our company's Q4 earnings" → Single retrieval
Complex: "Analyze correlation between customer churn and product feature usage across segments" → Multi-step
```

**Implementation Approach:**
```typescript
async function adaptiveRAG(query: string) {
  // Classify query complexity
  const complexity = await classifyComplexity(query);

  switch (complexity) {
    case 'straightforward':
      // Direct LLM generation
      return await llm.generate(query);

    case 'simple':
      // Standard RAG (single retrieval)
      const docs = await vectorSearch(query);
      return await llm.generate(query, docs);

    case 'complex':
      // Multi-step agentic RAG
      return await agenticRAGLoop(query); // reflection + retry

    default:
      return await standardRAG(query); // fallback
  }
}
```

**When to Use:**
- Variable query complexity (mix of simple and complex)
- Cost/latency optimization critical
- Resource constraints (limit expensive multi-step for complex queries only)

**Benefits:**
- **Resource Efficiency**: Avoids unnecessary computation
- **Cost Savings**: Fewer LLM calls for simple queries
- **Speed**: Fast path for straightforward questions
- **Accuracy**: Deep reasoning for complex queries

---

### Pattern 4: Corrective RAG (CRAG)

**Concept:** Self-correction through retrieval evaluation and supplementary searches.

**How It Works:**
1. Retrieve documents from vector store
2. **Retrieval Evaluator** (LLM-based) assesses relevance for each document
3. Assign confidence grade: Correct / Ambiguous / Incorrect
4. **Conditional Actions**:
   - **Correct**: Proceed with retrieved docs → Generate answer
   - **Ambiguous**: Refine search (query rewrite) + supplement with web search
   - **Incorrect**: Discard docs, rewrite query, search web
5. **Knowledge Refinement**: Decompose retrieved docs, extract key snippets only
6. Generate final answer using refined context

**Key Components:**
- **Retrieval Evaluator**: LLM scoring document relevance (binary or graded)
- **Grade Node**: Relevance assessment logic
- **Query Rewrite Node**: Reformulates query when retrieval fails
- **Web Search Integration**: Fallback for knowledge gaps in corpus
- **Decompose-Recompose Algorithm**: Filters irrelevant content from docs

**Evaluation Prompts:**
```typescript
const evaluationPrompt = `
Given the question: "${query}"
And the retrieved document: "${doc.content}"

Is this document relevant to answering the question?
Return: "Correct" / "Ambiguous" / "Incorrect"
`;
```

**Implementation Approach:**
```typescript
async function correctiveRAG(query: string) {
  // Step 1: Initial retrieval
  const docs = await vectorSearch(query);

  // Step 2: Evaluate relevance
  const grades = await Promise.all(
    docs.map(doc => evaluateRelevance(query, doc))
  );

  // Step 3: Conditional branching
  const correctDocs = docs.filter((_, i) => grades[i] === 'Correct');
  const hasAmbiguous = grades.includes('Ambiguous');
  const hasIncorrect = grades.includes('Incorrect');

  if (correctDocs.length > 0 && !hasIncorrect) {
    // Use retrieved docs directly
    return await llm.generate(query, correctDocs);
  }

  if (hasAmbiguous || hasIncorrect) {
    // Step 4: Query rewrite
    const rewrittenQuery = await llm.rewriteQuery(query);

    // Step 5: Web search supplement
    const webResults = await webSearch(rewrittenQuery);

    // Step 6: Re-retrieve with rewritten query
    const newDocs = await vectorSearch(rewrittenQuery);

    // Step 7: Combine and filter
    const allContext = [...correctDocs, ...newDocs, ...webResults];
    const refinedContext = decomposeAndFilter(allContext);

    return await llm.generate(query, refinedContext);
  }
}
```

**When to Use:**
- Uncertain retrieval quality (noisy corpus)
- Knowledge base has gaps (needs web supplementation)
- High factuality requirements
- User-uploaded documents (variable quality)

**Benefits:**
- **Self-Healing**: Automatically fixes poor retrieval
- **Supplementation**: Augments internal knowledge with external sources
- **Quality Assurance**: Validates before generation

---

### Pattern 5: Self-Reflective RAG

**Concept:** Dynamic on-demand retrieval with self-critique mechanisms.

**How It Works:**
1. Receive user query
2. **Retrieval Decision**: LLM decides if retrieval is needed (yes/no)
   - If sufficient knowledge exists → Skip retrieval
   - If knowledge gap detected → Trigger retrieval
3. If retrieval triggered: Fetch documents from vector store
4. **Relevance Reflection**: Evaluate if retrieved docs answer the question
   - If relevant → Proceed to generation
   - If irrelevant → Rewrite query, re-retrieve
5. **Generation with Self-Critique**: Generate answer segment-by-segment
6. **Hallucination Check**: Each segment validated against retrieved context
7. If hallucination detected → Regenerate segment or retrieve more context
8. Return verified answer

**Key Components:**
- **Reflection Tokens**: Special tokens signaling retrieval need and critique points
- **On-Demand Retrieval**: Conditional execution (not always-on)
- **Self-Critique Mechanism**: Post-generation validation
- **Document Relevance Evaluator**: Assesses context quality
- **Hallucination Detector**: Verifies factual grounding
- **Query Transformation**: Rewrites queries when retrieval fails

**Reflection Token Example:**
```
LLM Output: "[RETRIEVE] I need to check the latest financial data. [/RETRIEVE]"
System Action: Trigger vector search for financial data

LLM Output: "[CRITIQUE] The previous statement about revenue growth lacks citation. [/CRITIQUE]"
System Action: Verify against retrieved documents, regenerate if needed
```

**Implementation Approach:**
```typescript
async function selfReflectiveRAG(query: string) {
  // Step 1: Decide if retrieval needed
  const needsRetrieval = await llm.shouldRetrieve(query);

  let context = [];
  if (needsRetrieval) {
    // Step 2: Retrieve documents
    context = await vectorSearch(query);

    // Step 3: Evaluate relevance
    const isRelevant = await llm.evaluateRelevance(query, context);

    if (!isRelevant) {
      // Step 4: Rewrite and re-retrieve
      const rewrittenQuery = await llm.rewriteQuery(query);
      context = await vectorSearch(rewrittenQuery);
    }
  }

  // Step 5: Generate with self-critique
  let answer = '';
  const segments = await llm.generateSegmented(query, context);

  for (const segment of segments) {
    // Step 6: Validate each segment
    const isGrounded = await llm.verifyGrounding(segment, context);

    if (isGrounded) {
      answer += segment;
    } else {
      // Step 7: Regenerate hallucinated segment
      const corrected = await llm.regenerateWithContext(segment, context);
      answer += corrected;
    }
  }

  return answer;
}
```

**When to Use:**
- Knowledge-intensive tasks requiring evidence-based answers
- Cost optimization (avoid unnecessary retrievals)
- High factuality requirements (minimize hallucinations)
- Mixed queries (some answerable without retrieval)

**Benefits:**
- **Efficiency**: Only retrieves when truly needed
- **Quality Control**: Validates generated content
- **Hallucination Reduction**: Self-critique prevents fabrication
- **Adaptive**: Adjusts retrieval strategy based on reflection

---

### Pattern 6: Speculative RAG

**Concept:** Parallel drafting by specialist model, verification by generalist model.

**How It Works:**
1. Divide retrieved documents into subsets (e.g., 3 chunks each)
2. **Specialist Drafter** (small, fast LM) generates multiple answer drafts in parallel
   - Draft 1 from chunks [0-2]
   - Draft 2 from chunks [3-5]
   - Draft 3 from chunks [6-8]
3. Each draft includes rationale (why this answer is correct)
4. **Generalist Verifier** (large, powerful LM) evaluates all drafts
5. Verifier scores drafts based on confidence and factual grounding
6. Select highest-scoring draft as final answer
7. Optionally: Verifier refines selected draft

**Key Components:**
- **Specialist RAG Drafter**: Small LM (e.g., GPT-3.5, Llama 7B) for fast drafting
- **Generalist Verifier**: Large LM (e.g., GPT-4, Llama 70B) for quality assessment
- **Parallel Document Processing**: Multiple subsets processed simultaneously
- **Multi-Draft Generation**: N candidate answers with rationales
- **Scoring Mechanism**: Confidence + factuality + coherence metrics
- **Selection Logic**: Argmax(scores) or ensemble

**Draft Example:**
```
Draft 1 (chunks 0-2):
Answer: "Revenue increased 25% YoY due to cloud services growth."
Rationale: "Financial report Q4 explicitly states 25% YoY growth driven by cloud segment."

Draft 2 (chunks 3-5):
Answer: "Revenue grew 20% YoY with product sales leading."
Rationale: "Annual summary mentions 20% growth with hardware sales as primary driver."

Verifier Scoring:
Draft 1: Confidence 0.9, Factuality 0.95 → Score: 0.925
Draft 2: Confidence 0.7, Factuality 0.85 → Score: 0.775

Selected: Draft 1
```

**Implementation Approach:**
```typescript
async function speculativeRAG(query: string, allDocs: Document[]) {
  // Step 1: Partition documents
  const docSubsets = partitionDocuments(allDocs, chunksPerDraft: 3);

  // Step 2: Generate drafts in parallel (fast small model)
  const drafts = await Promise.all(
    docSubsets.map(subset =>
      smallLM.generateWithRationale(query, subset)
    )
  );

  // Step 3: Score drafts (large model)
  const scores = await Promise.all(
    drafts.map(draft =>
      largeLM.scoreDraft(query, draft, allDocs)
    )
  );

  // Step 4: Select best draft
  const bestIndex = scores.indexOf(Math.max(...scores));
  const bestDraft = drafts[bestIndex];

  // Optional Step 5: Refine with large model
  const refinedAnswer = await largeLM.refine(bestDraft, allDocs);

  return refinedAnswer;
}
```

**When to Use:**
- Speed + accuracy both critical
- Large document sets (100+ chunks)
- Cost constraints (minimize large model usage)
- Knowledge-intensive questions with complex reasoning

**Benefits:**
- **Speed**: Small model drafts in parallel faster than sequential large model
- **Accuracy**: Large model verification ensures quality
- **Cost Efficiency**: Majority of work done by cheaper small model
- **Robustness**: Multiple drafts provide redundancy

**Trade-offs:**
- Increased system complexity
- Requires maintaining two model sizes
- Additional latency for verification step

---

### Pattern 7: Self-Route Agentic RAG

**Concept:** LLM-driven routing between standard RAG and long-context processing.

**How It Works:**
1. Retrieve initial context from vector store (e.g., top-5 chunks)
2. **Answerability Judge**: LLM evaluates if retrieved context is sufficient
   - Prompt: "Can you answer this question with the given context? Reply 'ANSWERABLE' or 'UNANSWERABLE'"
3. **Conditional Routing**:
   - **ANSWERABLE** → Route to Standard RAG flow (use top-K chunks)
   - **UNANSWERABLE** → Route to Long-Context LLM flow (merge related documents)
4. If unanswerable:
   - Expand context by fetching all chunks from relevant documents
   - Merge full documents into single long context
   - Send to long-context LLM (e.g., GPT-4 Turbo 128K, Claude 200K)
5. Generate answer using appropriate flow

**Key Components:**
- **Decision Node**: LLM judge with answerability prompt
- **Standard RAG Flow**: Top-K chunks → Regular context window
- **Long-Context Flow**: Full document merge → Extended context window
- **Vector Database**: Initial retrieval
- **Context Merging**: Combines related documents
- **Two Generation Prompts**: Standard RAG prompt vs long-context prompt

**Answerability Assessment:**
```typescript
const judgePrompt = `
Given the question: "${query}"
And the retrieved context: "${topKChunks}"

Can you confidently answer this question with the provided context?

Reply ONLY with:
- "ANSWERABLE" if context is sufficient
- "UNANSWERABLE" if you need more information
`;

const judgment = await llm.judge(judgePrompt);
```

**Implementation Approach:**
```typescript
async function selfRouteRAG(query: string) {
  // Step 1: Initial retrieval (top-K chunks)
  const topKChunks = await vectorSearch(query, topK: 5);

  // Step 2: Answerability judgment
  const isAnswerable = await llm.canAnswer(query, topKChunks);

  if (isAnswerable === 'ANSWERABLE') {
    // Route A: Standard RAG
    return await llm.generate(query, topKChunks);
  } else {
    // Route B: Long-context flow

    // Step 3: Get full documents for relevant chunks
    const documentIds = [...new Set(topKChunks.map(c => c.documentId))];
    const fullDocuments = await fetchFullDocuments(documentIds);

    // Step 4: Merge documents into long context
    const longContext = mergeDocuments(fullDocuments);

    // Step 5: Generate with long-context model
    return await longContextLLM.generate(query, longContext);
  }
}
```

**When to Use:**
- Variable query complexity (some need full context, others don't)
- Cost optimization (long-context models more expensive)
- Documents with complex inter-dependencies
- Queries requiring holistic understanding vs specific facts

**Benefits:**
- **Cost Efficiency**: Use standard RAG for most queries
- **Accuracy**: Full context for complex queries requiring holistic view
- **Automatic Routing**: No manual classification needed
- **Adaptive**: Self-adjusts based on retrieval adequacy

**Example Routing Logic:**
```
Query: "What is the revenue in Q4?"
Top-5 chunks contain explicit answer → ANSWERABLE → Standard RAG

Query: "Analyze the relationship between customer satisfaction scores and product roadmap priorities"
Top-5 chunks have pieces but lack connections → UNANSWERABLE → Long-context flow (merge satisfaction reports + roadmap docs)
```

---

## 4. Core Agentic Capabilities

### 4.1 Planning

**Definition:** Breaking complex tasks into step-by-step execution plans.

**Mechanisms:**
- **Task Decomposition**: Split multi-faceted queries into subtasks
- **Dependency Analysis**: Determine sequential vs parallel execution
- **Resource Allocation**: Assign subtasks to appropriate tools
- **Plan Refinement**: Adjust plan based on intermediate results

**Example:**
```
User Query: "Compare our product performance to competitors and suggest improvements"

Agent Plan:
1. Retrieve our product metrics from vector store (parallel)
2. Search web for competitor product specs (parallel)
3. Wait for (1) and (2) to complete
4. Retrieve customer feedback from database (sequential after 1)
5. Synthesize comparison highlighting gaps
6. Generate improvement suggestions based on gaps
```

**Implementation Pattern (ReAct):**
```typescript
async function planningAgent(query: string) {
  // Thought: What information do I need?
  const plan = await llm.think(`
    I need to answer: ${query}
    What steps are required? Create a numbered plan.
  `);

  // Execute plan
  const results = [];
  for (const step of plan.steps) {
    const observation = await executeStep(step);
    results.push(observation);

    // Thought: Should I adjust the plan?
    const shouldContinue = await llm.reflect(query, results);
    if (!shouldContinue) break;
  }

  // Final answer
  return await llm.synthesize(query, results);
}
```

---

### 4.2 Reasoning

**Definition:** Analyzing queries, evaluating evidence, and drawing logical conclusions.

**Types of Reasoning:**

1. **Intent Recognition**: Understanding what the user truly wants
2. **Relevance Assessment**: Evaluating if retrieved documents match query intent
3. **Evidence Evaluation**: Assessing credibility and sufficiency of sources
4. **Logical Inference**: Drawing conclusions from multiple pieces of information
5. **Causal Analysis**: Identifying cause-effect relationships

**Example:**
```
Query: "Why did sales drop in Q3?"

Reasoning Chain:
1. Identify intent: User wants causal explanation (not just facts)
2. Retrieve: Q3 sales data + marketing campaigns + market conditions
3. Evaluate: Which factors correlate with sales drop?
4. Infer: Drop occurred after price increase (causal link)
5. Conclude: "Sales dropped 15% in Q3 primarily due to 20% price increase implemented in July, which reduced demand among price-sensitive segments."
```

**ReAct Pattern (Reason + Act):**
```typescript
async function reactAgent(query: string) {
  let thought = "";
  let observation = "";
  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    // Reason: What should I do next?
    thought = await llm.reason(`
      Query: ${query}
      Previous observation: ${observation}
      What action should I take? Or can I answer now?
    `);

    if (thought.includes("ANSWER:")) {
      // Agent decided it has enough information
      return extractAnswer(thought);
    }

    // Act: Execute the planned action
    const action = extractAction(thought); // e.g., "search", "calculate"
    observation = await executeTool(action);
  }

  return "Unable to answer after maximum iterations";
}
```

---

### 4.3 Self-Correction

**Definition:** Identifying and fixing errors in retrieval or generation through reflection.

**Self-Correction Mechanisms:**

1. **Retrieval Quality Assessment**: Evaluate if retrieved docs are relevant
2. **Query Rewriting**: Reformulate queries when retrieval fails
3. **Hallucination Detection**: Verify generated claims against sources
4. **Answer Validation**: Check if response actually answers the question
5. **Iterative Refinement**: Loop until quality threshold met

**Correction Loop Pattern:**
```typescript
async function selfCorrectingRAG(query: string, maxRetries: number = 3) {
  let attempt = 0;
  let answer = "";

  while (attempt < maxRetries) {
    // Step 1: Retrieve
    const docs = attempt === 0
      ? await vectorSearch(query)
      : await vectorSearch(rewrittenQuery);

    // Step 2: Evaluate retrieval quality
    const quality = await llm.evaluateRetrievalQuality(query, docs);

    if (quality < 0.5) {
      // Low quality: rewrite query
      rewrittenQuery = await llm.rewriteQuery(query, docs);
      attempt++;
      continue;
    }

    // Step 3: Generate answer
    answer = await llm.generate(query, docs);

    // Step 4: Validate answer
    const isValid = await llm.validateAnswer(query, answer, docs);

    if (isValid) {
      return answer; // Success!
    } else {
      // Invalid answer: retry with refined query
      rewrittenQuery = await llm.refineQueryBasedOnFailure(query, answer);
      attempt++;
    }
  }

  return answer; // Return best attempt
}
```

**Example Self-Correction:**
```
Iteration 1:
Query: "What is the API rate limit?"
Retrieved: [doc about pricing, doc about authentication]
Quality: 0.3 (low relevance)
Action: Rewrite query → "API rate limit requests per minute"

Iteration 2:
Query: "API rate limit requests per minute"
Retrieved: [doc about rate limits, doc about quotas]
Quality: 0.9 (high relevance)
Generated Answer: "The API rate limit is 100 requests per minute."
Validation: Check if answer is grounded in retrieved docs → Yes
Return: Answer
```

---

### 4.4 Tool Use (Function Calling)

**Definition:** Agents dynamically select and execute external tools beyond retrieval.

**Common Tools for RAG Agents:**

1. **Vector Search**: Semantic similarity search in knowledge base
2. **BM25 Search**: Keyword-based full-text search
3. **Web Search**: External information from Google/Bing/DuckDuckGo
4. **SQL Query**: Structured data retrieval from databases
5. **Calculator**: Mathematical computations
6. **API Calls**: External service integration (weather, stock prices, etc.)
7. **Code Interpreter**: Execute Python/JavaScript for analysis
8. **Document Parser**: Extract text from PDFs/DOCX

**Tool Calling Flow (OpenAI Function Calling):**
```typescript
// Step 1: Define tools
const tools = [
  {
    type: "function",
    function: {
      name: "vector_search",
      description: "Search knowledge base for relevant documents",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          topK: { type: "number", description: "Number of results" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for latest information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
    }
  }
];

// Step 2: LLM decides which tool to call
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: userQuery }],
  tools: tools,
  tool_choice: "auto" // LLM decides
});

// Step 3: Execute tool calls
const toolCalls = response.choices[0].message.tool_calls;
const toolResults = [];

for (const call of toolCalls) {
  if (call.function.name === "vector_search") {
    const args = JSON.parse(call.function.arguments);
    const result = await vectorSearch(args.query, args.topK);
    toolResults.push({ tool_call_id: call.id, result });
  } else if (call.function.name === "web_search") {
    const args = JSON.parse(call.function.arguments);
    const result = await webSearch(args.query);
    toolResults.push({ tool_call_id: call.id, result });
  }
}

// Step 4: Send tool results back to LLM
const finalResponse = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "user", content: userQuery },
    response.choices[0].message, // assistant message with tool_calls
    ...toolResults.map(tr => ({
      role: "tool",
      tool_call_id: tr.tool_call_id,
      content: JSON.stringify(tr.result)
    }))
  ]
});

return finalResponse.choices[0].message.content;
```

**Multi-Tool Orchestration:**
```
User: "Find our company's revenue in 2024 and compare it to the industry average"

Agent Reasoning:
1. Need internal data → Use vector_search tool on company docs
2. Need industry data → Use web_search tool
3. Need comparison calculation → Use calculator tool

Tool Call 1: vector_search({ query: "company revenue 2024" })
Result: "$50M revenue in 2024"

Tool Call 2: web_search({ query: "tech industry average revenue 2024" })
Result: "Average tech company revenue: $35M"

Tool Call 3: calculator({ expression: "(50 - 35) / 35 * 100" })
Result: 42.86%

Final Answer: "Our company's revenue in 2024 was $50M, which is 43% above the industry average of $35M."
```

---

### 4.5 Reflection

**Definition:** Meta-cognitive process where agents evaluate their own reasoning and outputs.

**Reflection Types:**

1. **Epistemic Reflection**: "Do I have sufficient knowledge?"
2. **Procedural Reflection**: "Is my approach correct?"
3. **Outcome Reflection**: "Did I answer the question adequately?"
4. **Source Reflection**: "Are my sources credible?"

**Reflection Prompts:**
```typescript
// Reflection on retrieval sufficiency
const epistemicReflection = await llm.complete(`
I retrieved the following documents: ${docs}
For the question: "${query}"

Reflection: Is this information sufficient to answer the question?
If not, what additional information do I need?
`);

// Reflection on answer quality
const outcomeReflection = await llm.complete(`
Question: "${query}"
My answer: "${generatedAnswer}"

Critical self-evaluation:
1. Did I fully address the question?
2. Did I cite sources for factual claims?
3. Are there any unsupported assertions?
4. Confidence level (0-1): ?
`);
```

**Reflection Loop Pattern:**
```typescript
async function reflectiveRAG(query: string) {
  const maxReflectionCycles = 3;
  let answer = "";
  let satisfied = false;

  for (let cycle = 0; cycle < maxReflectionCycles && !satisfied; cycle++) {
    // Generate answer
    const docs = await vectorSearch(query);
    answer = await llm.generate(query, docs);

    // Reflect on answer quality
    const reflection = await llm.reflect(`
      Question: ${query}
      My answer: ${answer}
      Retrieved sources: ${docs}

      Self-critique:
      - Accuracy (grounded in sources?): ?
      - Completeness (all aspects addressed?): ?
      - Clarity (easy to understand?): ?

      Should I revise? (yes/no)
      If yes, what should I improve?
    `);

    if (reflection.shouldRevise === false) {
      satisfied = true;
    } else {
      // Incorporate reflection feedback
      query = query + "\n[Improvement needed: " + reflection.feedback + "]";
    }
  }

  return answer;
}
```

---

## 5. Implementation Frameworks & Technologies

### 5.1 LangGraph (Recommended for Agentic RAG)

**What is LangGraph?**
LangGraph is a library for building stateful, multi-actor applications with LLMs. It's built on top of LangChain and designed specifically for creating agent workflows with cycles and conditional logic.

**Key Concepts:**

- **State**: Shared data structure (e.g., `MessagesState` with message history)
- **Nodes**: Functions that process state (e.g., retrieve, evaluate, generate)
- **Edges**: Connections between nodes (conditional or fixed)
- **Graph**: Orchestrates node execution based on edges

**Basic LangGraph Structure:**
```typescript
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";

// Define nodes
async function retrieveNode(state: typeof MessagesAnnotation.State) {
  const query = state.messages[state.messages.length - 1].content;
  const docs = await vectorSearch(query);
  return {
    messages: [{ role: "system", content: formatDocs(docs) }]
  };
}

async function evaluateNode(state: typeof MessagesAnnotation.State) {
  const docs = extractDocs(state.messages);
  const relevant = await llm.evaluateRelevance(docs);
  return { metadata: { documentsRelevant: relevant } };
}

async function generateNode(state: typeof MessagesAnnotation.State) {
  const response = await llm.generate(state.messages);
  return { messages: [response] };
}

// Build graph
const graph = new StateGraph(MessagesAnnotation)
  .addNode("retrieve", retrieveNode)
  .addNode("evaluate", evaluateNode)
  .addNode("generate", generateNode)
  .addEdge("__start__", "retrieve")
  .addConditionalEdges(
    "retrieve",
    async (state) => state.metadata?.documentsRelevant ? "generate" : "rewrite",
    { generate: "generate", rewrite: "rewrite_query" }
  )
  .addEdge("generate", "__end__");

const app = graph.compile();

// Execute
const result = await app.invoke({
  messages: [{ role: "user", content: "What is the revenue?" }]
});
```

**LangGraph for Corrective RAG:**
```typescript
// Nodes
const nodes = {
  retrieve: async (state) => {
    const docs = await vectorSearch(state.query);
    return { ...state, documents: docs };
  },

  gradeDocuments: async (state) => {
    const grades = await Promise.all(
      state.documents.map(doc => llm.grade(state.query, doc))
    );
    const relevant = state.documents.filter((_, i) => grades[i] === "relevant");
    return { ...state, relevantDocs: relevant, needsRewrite: relevant.length === 0 };
  },

  rewriteQuery: async (state) => {
    const newQuery = await llm.rewrite(state.query);
    return { ...state, query: newQuery };
  },

  webSearch: async (state) => {
    const webDocs = await searchWeb(state.query);
    return { ...state, relevantDocs: [...state.relevantDocs, ...webDocs] };
  },

  generate: async (state) => {
    const answer = await llm.generate(state.query, state.relevantDocs);
    return { ...state, answer };
  }
};

// Build graph with conditional routing
const graph = new StateGraph({ channels: { query: null, documents: [], relevantDocs: [], needsRewrite: false, answer: "" } })
  .addNode("retrieve", nodes.retrieve)
  .addNode("gradeDocuments", nodes.gradeDocuments)
  .addNode("rewriteQuery", nodes.rewriteQuery)
  .addNode("webSearch", nodes.webSearch)
  .addNode("generate", nodes.generate)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "gradeDocuments")
  .addConditionalEdges("gradeDocuments", (state) => state.needsRewrite ? "rewriteQuery" : "webSearch")
  .addEdge("rewriteQuery", "retrieve") // Loop back
  .addEdge("webSearch", "generate")
  .addEdge("generate", "__end__");
```

**Why LangGraph for Agentic RAG?**
- ✅ Built-in cycle support (for iterative refinement)
- ✅ Conditional routing (adaptive strategies)
- ✅ State persistence (maintains context across steps)
- ✅ Streaming support (real-time updates)
- ✅ TypeScript/JavaScript support (browser-compatible)

---

### 5.2 LangChain (Foundation Layer)

**What is LangChain?**
LangChain provides modular components for building LLM applications: prompt templates, retrievers, chains, and tools.

**Key Components for RAG:**

1. **Document Loaders**: Parse PDFs, DOCX, markdown
2. **Text Splitters**: Chunk documents (RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter)
3. **Embeddings**: OpenAI, HuggingFace, etc.
4. **Vector Stores**: FAISS, Pinecone, Chroma, PGVector
5. **Retrievers**: Vector search, BM25, hybrid
6. **Chains**: Sequential processing pipelines
7. **Agents**: Tool-using conversational agents
8. **Tools**: Pre-built (web search, calculator) and custom tools

**LangChain ReAct Agent:**
```typescript
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";
import { createRetrieverTool } from "langchain/tools/retriever";

// Create tools
const vectorTool = createRetrieverTool(retriever, {
  name: "vector_search",
  description: "Search the knowledge base for relevant documents"
});

const webTool = new DuckDuckGoSearch();

const tools = [vectorTool, webTool];

// Create agent
const llm = new ChatOpenAI({ model: "gpt-4" });
const agent = createReactAgent({ llm, tools });

// Use agent
const result = await agent.invoke({
  messages: [{ role: "user", content: "What is our Q4 revenue?" }]
});
```

**Browser Compatibility:**
- ✅ `@langchain/core`: Core abstractions (browser-safe)
- ✅ `@langchain/openai`: OpenAI integration (works with `dangerouslyAllowBrowser: true`)
- ⚠️ `@langchain/community`: Some tools require Node.js (check before using)
- ✅ LangGraph: Full browser support with `@langchain/langgraph`

---

### 5.3 OpenAI Function Calling (Native Approach)

**Direct Implementation Without Frameworks:**

You can implement agentic RAG using only OpenAI's function calling API, which is fully browser-compatible.

**Complete ReAct Agent Example:**
```typescript
// Define tools
const tools = [
  {
    type: "function" as const,
    function: {
      name: "vector_search",
      description: "Search knowledge base using semantic similarity",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          topK: { type: "number", description: "Number of results", default: 5 }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Search the web for current information",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "final_answer",
      description: "Provide the final answer to the user",
      parameters: {
        type: "object",
        properties: {
          answer: { type: "string" }
        },
        required: ["answer"]
      }
    }
  }
];

// Tool execution functions
const toolExecutors = {
  vector_search: async (args: { query: string; topK?: number }) => {
    const results = await vectorSearch(args.query, args.topK || 5);
    return JSON.stringify(results);
  },

  web_search: async (args: { query: string }) => {
    const results = await fetch(`https://api.duckduckgo.com/?q=${args.query}&format=json`);
    return JSON.stringify(await results.json());
  },

  final_answer: async (args: { answer: string }) => {
    return args.answer; // Special: signals completion
  }
};

// ReAct loop
async function reactAgent(userQuery: string, maxIterations: number = 5) {
  const messages = [
    {
      role: "system",
      content: "You are a helpful assistant. Use tools to gather information before answering. When ready to answer, use the final_answer tool."
    },
    {
      role: "user",
      content: userQuery
    }
  ];

  for (let i = 0; i < maxIterations; i++) {
    // LLM decides next action
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      tools,
      tool_choice: "auto"
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);

    // Check if LLM wants to use tools
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      // No tool calls: return text response
      return assistantMessage.content;
    }

    // Execute tool calls
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      console.log(`[Agent] Calling tool: ${functionName}`, functionArgs);

      // Special case: final_answer signals completion
      if (functionName === "final_answer") {
        return functionArgs.answer;
      }

      // Execute tool
      const executor = toolExecutors[functionName];
      const result = await executor(functionArgs);

      console.log(`[Agent] Tool result:`, result);

      // Add tool result to messages
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result
      });
    }
  }

  return "Maximum iterations reached without final answer";
}

// Usage
const answer = await reactAgent("What is our company revenue and how does it compare to competitors?");
```

**Streaming with Function Calling:**
```typescript
async function* reactAgentStreaming(userQuery: string) {
  const messages = [/* ... */];

  for (let i = 0; i < maxIterations; i++) {
    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      tools,
      stream: true
    });

    let currentToolCall = { id: "", name: "", arguments: "" };
    let textBuffer = "";

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Handle text streaming
      if (delta?.content) {
        textBuffer += delta.content;
        yield { type: "text", content: delta.content };
      }

      // Handle tool call streaming
      if (delta?.tool_calls) {
        const toolCallDelta = delta.tool_calls[0];
        if (toolCallDelta.id) currentToolCall.id = toolCallDelta.id;
        if (toolCallDelta.function?.name) currentToolCall.name = toolCallDelta.function.name;
        if (toolCallDelta.function?.arguments) currentToolCall.arguments += toolCallDelta.function.arguments;
      }

      // Tool call complete
      if (chunk.choices[0]?.finish_reason === "tool_calls") {
        yield { type: "tool_call", tool: currentToolCall.name, args: JSON.parse(currentToolCall.arguments) };

        // Execute tool
        const result = await toolExecutors[currentToolCall.name](JSON.parse(currentToolCall.arguments));

        if (currentToolCall.name === "final_answer") {
          return; // Done
        }

        yield { type: "tool_result", tool: currentToolCall.name, result };

        // Add to messages and continue loop
        messages.push({
          role: "assistant",
          tool_calls: [{ id: currentToolCall.id, type: "function", function: { name: currentToolCall.name, arguments: currentToolCall.arguments } }]
        });
        messages.push({
          role: "tool",
          tool_call_id: currentToolCall.id,
          content: result
        });

        break; // Next iteration
      }
    }
  }
}

// Usage
for await (const event of reactAgentStreaming("What is the revenue?")) {
  if (event.type === "text") {
    console.log(event.content);
  } else if (event.type === "tool_call") {
    console.log(`Calling ${event.tool}...`);
  } else if (event.type === "tool_result") {
    console.log(`Result: ${event.result}`);
  }
}
```

---

### 5.4 Browser-Specific Considerations

**Web Workers for Background Processing:**

Since agentic RAG involves iterative loops (planning → tool execution → reflection), running this on the main thread can freeze the UI. Use Web Workers:

```typescript
// agent.worker.ts
import { wrap } from "comlink";

export async function agenticRAG(query: string, apiKey: string) {
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  // ... ReAct agent implementation ...

  return answer;
}

// Expose worker API
expose({ agenticRAG });
```

```typescript
// main.ts
import { wrap } from "comlink";
import AgentWorker from "./agent.worker?worker";

const worker = new AgentWorker();
const api = wrap<typeof import("./agent.worker")>(worker);

// Use from main thread
const answer = await api.agenticRAG("What is the revenue?", apiKey);
```

**IndexedDB for State Persistence:**

Persist agent state (conversation history, tool call logs) to survive page reloads:

```typescript
// Store conversation + agent state
await db.conversations.put({
  id: conversationId,
  messages: messages,
  agentState: {
    currentPlan: plan,
    toolCallHistory: toolCalls,
    reflections: reflections
  },
  timestamp: Date.now()
});

// Resume from state
const conversation = await db.conversations.get(conversationId);
const messages = conversation.messages;
// Continue agent loop from where it left off
```

**Streaming UI Updates:**

Update UI in real-time as agent executes tools:

```typescript
async function runAgentWithUI(query: string) {
  for await (const event of reactAgentStreaming(query)) {
    switch (event.type) {
      case "thought":
        addThoughtBubble(event.content); // "I need to search the knowledge base..."
        break;
      case "tool_call":
        showToolExecution(event.tool, event.args); // Loading spinner
        break;
      case "tool_result":
        showToolResult(event.tool, event.result); // Show retrieved docs
        break;
      case "text":
        streamAnswerText(event.content); // Final answer
        break;
    }
  }
}
```

---

## 6. Browser-Based Agentic RAG Implementation Considerations

### 6.1 Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| **UI Blocking** | Use Web Workers for agent loops (planning, tool execution) |
| **State Persistence** | Store conversation + agent state in IndexedDB/PGlite |
| **Streaming Complexity** | Implement event-driven UI updates (tool calls, thoughts, results) |
| **Function Call Parsing** | Handle streaming tool calls (arguments arrive in chunks) |
| **Cost Control** | Implement max_iterations limit (default: 5) to prevent runaway loops |
| **Error Handling** | Catch tool execution failures, allow agent to retry with different tools |
| **Memory Management** | Clear old conversation states periodically (LRU cache) |

---

### 6.2 Architecture for Browser-Based Agentic RAG

**Recommended Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                    Main Thread (React)                   │
│  • Chat UI with thought bubbles                          │
│  • Tool call visualizations                              │
│  • Source citations display                              │
│  • Agent state display (current plan, iteration count)   │
└────────────────────┬────────────────────────────────────┘
                     │ Comlink RPC
                     ↓
┌─────────────────────────────────────────────────────────┐
│                Web Worker (Agent Executor)               │
│  ┌──────────────────────────────────────────────────┐   │
│  │  ReAct Agent Loop                                │   │
│  │  1. LLM decides next action (OpenAI function call)│  │
│  │  2. Execute tool (vector search, web search, etc)│   │
│  │  3. Reflect on result                            │   │
│  │  4. Repeat until final_answer                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Tool Executors                                  │   │
│  │  • vector_search → PGlite query                 │   │
│  │  • bm25_search → Lunr query                     │   │
│  │  • web_search → DuckDuckGo API                  │   │
│  │  • calculate → Math.js                          │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 Storage Layer (IndexedDB)                │
│  • PGlite database (vectors, chunks, documents)          │
│  • Lunr index (BM25 full-text search)                    │
│  • Conversation history (messages + agent state)         │
└─────────────────────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────┐
│                   External APIs                          │
│  • OpenAI Chat Completions API (agent reasoning)         │
│  • OpenAI Embeddings API (query embeddings)              │
│  • DuckDuckGo Search API (web tool)                      │
└─────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **Agent in Worker**: Prevents UI freezing during multi-step reasoning
2. **PGlite for Vector Search**: Already implemented, reuse existing infrastructure
3. **Lunr for BM25**: Already implemented, reuse for keyword tool
4. **OpenAI Function Calling**: Native browser support, no LangGraph needed (optional)
5. **Streaming Events**: Real-time UI updates (thought → tool call → result → answer)

---

### 6.3 Minimal Agentic RAG (No Framework)

**Simplest Implementation for Our App:**

```typescript
// src/workers/agent.worker.ts
import { PGlite } from "@electric-sql/pglite";
import { OpenAI } from "openai";

const db = await PGlite.create(/* ... */);
const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

// Tool definitions
const tools = [
  {
    type: "function" as const,
    function: {
      name: "vector_search",
      description: "Search knowledge base semantically",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "final_answer",
      description: "Provide final answer when ready",
      parameters: {
        type: "object",
        properties: {
          answer: { type: "string" }
        }
      }
    }
  }
];

// Tool executors
async function vectorSearch(query: string) {
  // Generate embedding
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: query
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Search PGlite
  const result = await db.query(`
    SELECT c.content, c.heading, d.filename,
           1 - (c.embedding <=> $1::vector) as similarity
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    ORDER BY c.embedding <=> $1::vector
    LIMIT 5
  `, [JSON.stringify(queryEmbedding)]);

  return result.rows;
}

// ReAct agent
export async function* agenticRAG(userQuery: string) {
  const messages = [
    { role: "system", content: "Use tools to gather info before answering." },
    { role: "user", content: userQuery }
  ];

  const maxIterations = 5;

  for (let i = 0; i < maxIterations; i++) {
    yield { type: "iteration", count: i + 1 };

    // LLM reasoning
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      tools
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (!message.tool_calls) {
      yield { type: "answer", content: message.content };
      return;
    }

    // Execute tools
    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments);

      yield { type: "tool_call", name: call.function.name, args };

      if (call.function.name === "final_answer") {
        yield { type: "answer", content: args.answer };
        return;
      }

      if (call.function.name === "vector_search") {
        const results = await vectorSearch(args.query);
        yield { type: "tool_result", name: "vector_search", results };

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(results)
        });
      }
    }
  }
}
```

**Usage in React:**
```typescript
// src/hooks/useAgenticChat.ts
import { wrap } from "comlink";
import AgentWorker from "@/workers/agent.worker?worker";

export function useAgenticChat() {
  const workerRef = useRef<Worker>();
  const apiRef = useRef<any>();

  useEffect(() => {
    workerRef.current = new AgentWorker();
    apiRef.current = wrap(workerRef.current);
  }, []);

  const sendMessage = async (query: string) => {
    const stream = apiRef.current.agenticRAG(query);

    for await (const event of stream) {
      switch (event.type) {
        case "iteration":
          addThought(`Thinking... (step ${event.count})`);
          break;
        case "tool_call":
          addThought(`Searching knowledge base: "${event.args.query}"`);
          break;
        case "tool_result":
          addSources(event.results);
          break;
        case "answer":
          addMessage({ role: "assistant", content: event.content });
          break;
      }
    }
  };

  return { sendMessage };
}
```

---

## 7. Gap Analysis: Our App vs Agentic RAG Requirements

### 7.1 What We Have (Current Implementation)

✅ **Strong Foundation:**
- **PGlite + pgvector**: Vector storage with HNSW index
- **Hybrid Search**: Vector + BM25 fusion
- **Embeddings Pipeline**: OpenAI text-embedding-3-small
- **Chat Integration**: Streaming completions with context injection
- **IndexedDB Persistence**: Documents, chunks, conversation history
- **Per-Message Sources**: Source tracking for citations
- **Configurable Settings**: Search parameters (topK, threshold, BM25 limit)
- **Browser-Only**: No backend required

### 7.2 What We're Missing (Agentic Capabilities)

❌ **Agent Layer:**
- ⬜ **Planning**: No query decomposition or multi-step workflows
- ⬜ **Reasoning Loops**: No iterative refinement (single-pass only)
- ⬜ **Tool Calling**: No function calling integration with OpenAI API
- ⬜ **Reflection**: No retrieval quality assessment or self-correction
- ⬜ **Adaptive Routing**: All queries use same hybrid search (no complexity classification)
- ⬜ **Multi-Tool Orchestration**: Only vector+BM25 (no web search, SQL, calculator, etc.)
- ⬜ **Query Rewriting**: No automatic query reformulation on retrieval failure

❌ **UI for Agents:**
- ⬜ **Thought Visualization**: No display of agent reasoning process
- ⬜ **Tool Call Display**: No indication of which tools are being used
- ⬜ **Iteration Tracking**: No visibility into multi-step workflows
- ⬜ **Agent State**: No plan display or current step indicator

❌ **Advanced Patterns:**
- ⬜ **Corrective RAG**: No relevance grading or web search fallback
- ⬜ **Self-Reflective RAG**: No on-demand retrieval decision logic
- ⬜ **Adaptive RAG**: No complexity-based routing
- ⬜ **Query Planning**: No subtask decomposition

### 7.3 Minimal Changes for Agentic RAG

**Highest ROI Additions (Phased Approach):**

**Phase agentic-foundation: Basic ReAct Agent**
- Add OpenAI function calling to `useChat` hook
- Define 2 tools: `vector_search`, `final_answer`
- Implement simple ReAct loop (max 5 iterations)
- Display tool calls in chat UI

**Phase agentic-reflection: Retrieval Quality Check**
- Add `evaluate_relevance` tool (LLM grades retrieved docs)
- Implement query rewriting when relevance < threshold
- Show reflection thoughts in UI

**Phase agentic-tools: Multi-Tool Support**
- Add `web_search` tool (DuckDuckGo API)
- Add `bm25_search` tool (use existing Lunr index)
- Agent autonomously selects tools

**Phase agentic-planning: Query Decomposition**
- Add `create_plan` step before tool execution
- Display execution plan in UI
- Parallel tool execution where possible

**Phase agentic-adaptive: Complexity Routing**
- Lightweight complexity classifier
- Route simple queries to standard RAG (bypass agent)
- Route complex queries to full agentic workflow

---

## 8. Recommendations for Our Browser-Based App

### 8.1 Recommended Architecture Pattern

**Best Fit: Hybrid Corrective RAG + Self-Route**

**Why:**
1. **Corrective RAG**: Addresses common issue of poor retrieval from user-uploaded docs (variable quality)
2. **Self-Route**: Optimizes cost by using simple RAG for easy queries, agentic RAG for complex
3. **Browser-Compatible**: No server-side dependencies, works with OpenAI function calling
4. **Incremental Adoption**: Can layer on top of existing hybrid search

**Architecture:**
```
User Query
    ↓
┌─────────────────────────────┐
│ Complexity Classifier (LLM) │ ← Simple prompt: "Is this answerable with basic search?"
└────────┬───────────┬────────┘
         │           │
    Simple      Complex
         │           │
         ↓           ↓
   ┌─────────┐  ┌──────────────────────┐
   │ Current │  │  Agentic RAG Loop    │
   │ Hybrid  │  │  1. Retrieve         │
   │ Search  │  │  2. Grade Relevance  │
   │ (fast)  │  │  3. If poor:         │
   │         │  │     - Rewrite query  │
   │         │  │     - Web search     │
   │         │  │  4. Generate         │
   └─────────┘  └──────────────────────┘
```

### 8.2 Implementation Phases

**Phase agentic-foundation: Basic Agent Infrastructure**
- Duration: 3-5 days
- Tasks:
  1. Add OpenAI function calling to chat API
  2. Create agent worker (Web Worker for background processing)
  3. Implement simple ReAct loop (thought → action → observation)
  4. Define 2 core tools: `vector_search`, `final_answer`
  5. Add thought bubble UI component
  6. Wire up agent to chat page (new "Agent Mode" toggle)

**Phase agentic-reflection: Retrieval Quality + Self-Correction**
- Duration: 2-3 days
- Tasks:
  1. Add `evaluate_relevance` function (LLM grades each retrieved doc)
  2. Implement query rewriting when docs scored low
  3. Add retry logic (max 2 rewrites)
  4. Display reflection thoughts in UI ("Retrieved docs not relevant, refining query...")
  5. Track and display iteration count

**Phase agentic-tools: Multi-Tool Orchestration**
- Duration: 3-4 days
- Tasks:
  1. Add `web_search` tool (integrate DuckDuckGo API)
  2. Add `bm25_search` tool (call existing Lunr index)
  3. Add `hybrid_search` tool (call existing RRF fusion)
  4. Update agent to autonomously select tools
  5. Display tool selection in UI with icons
  6. Add tool result previews (expandable cards)

**Phase agentic-adaptive: Complexity-Based Routing**
- Duration: 2-3 days
- Tasks:
  1. Create complexity classifier prompt (straightforward/simple/complex)
  2. Route straightforward queries to LLM-only (no retrieval)
  3. Route simple queries to current hybrid search (single-pass)
  4. Route complex queries to full agentic loop
  5. Add complexity indicator in UI
  6. Measure cost savings (track LLM call counts before/after)

**Phase agentic-planning: Query Decomposition (Optional)**
- Duration: 4-5 days
- Tasks:
  1. Add `create_plan` tool (LLM decomposes query into subtasks)
  2. Display execution plan in UI (numbered steps)
  3. Execute subtasks sequentially or in parallel
  4. Synthesize results from multiple subtasks
  5. Handle complex comparative/analytical queries

---

### 8.3 Quick Wins (Implement First)

**1. Basic ReAct Agent (Highest Impact, Low Effort)**

Add a simple agent loop that:
- Retrieves docs using existing hybrid search
- Evaluates if docs are sufficient
- Optionally refines query if not
- Generates answer

**Code Snippet:**
```typescript
// src/lib/simple-agent.ts
export async function simpleAgent(query: string, openai: OpenAI) {
  const tools = [
    { type: "function", function: { name: "search_docs", description: "...", parameters: {...} } },
    { type: "function", function: { name: "final_answer", description: "...", parameters: {...} } }
  ];

  const messages = [{ role: "user", content: query }];
  const maxIterations = 3;

  for (let i = 0; i < maxIterations; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages,
      tools
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (message.tool_calls) {
      for (const call of message.tool_calls) {
        if (call.function.name === "search_docs") {
          const args = JSON.parse(call.function.arguments);
          const results = await hybridSearch(args.query); // Reuse existing!
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(results) });
        } else if (call.function.name === "final_answer") {
          const args = JSON.parse(call.function.arguments);
          return args.answer;
        }
      }
    } else {
      return message.content;
    }
  }
}
```

**2. Thought Display UI**

Show agent reasoning in chat:

```typescript
// src/components/ThoughtBubble.tsx
export function ThoughtBubble({ thought }: { thought: string }) {
  return (
    <div className="flex items-start gap-2 opacity-70 text-sm italic mb-2">
      <Brain className="w-4 h-4 mt-0.5" />
      <span>{thought}</span>
    </div>
  );
}

// Usage in ChatPage
{message.type === "thought" && <ThoughtBubble thought={message.content} />}
```

**3. Agent Mode Toggle**

Let users choose between:
- **Standard Mode**: Current hybrid search (fast, cheap)
- **Agent Mode**: ReAct agent (slower, more accurate for complex queries)

```typescript
// Add to chat state
const [agentMode, setAgentMode] = useState(false);

// In sendMessage:
if (agentMode) {
  const answer = await simpleAgent(message, openai);
  addMessage({ role: "assistant", content: answer });
} else {
  // Existing hybrid search flow
}
```

---

### 8.4 Technology Choices

**Option A: Pure OpenAI Function Calling (Recommended)**
- ✅ Zero dependencies
- ✅ Full browser support
- ✅ Direct control over agent loop
- ✅ Easy to debug
- ⚠️ Manual state management

**Option B: LangGraph**
- ✅ Structured graph workflows
- ✅ Built-in state persistence
- ✅ Conditional routing
- ⚠️ Learning curve
- ⚠️ Additional bundle size (~100KB)

**Recommendation:** Start with **Option A** (pure OpenAI). Migrate to LangGraph only if you need complex multi-agent workflows or graph visualizations.

---

### 8.5 Cost & Performance Estimates

**Current Hybrid Search (per query):**
- 1 embedding call (query): ~$0.00001
- 1 chat completion: ~$0.002 (gpt-3.5-turbo)
- **Total: ~$0.002/query**

**Agentic RAG (per complex query):**
- 1 embedding call: ~$0.00001
- 3-5 chat completions (iterations): ~$0.006-$0.01
- Optional web search calls: Free (DuckDuckGo)
- **Total: ~$0.01/query (5x cost)**

**Mitigation with Adaptive Routing:**
- 70% of queries are simple → Use standard RAG ($0.002)
- 30% of queries are complex → Use agentic RAG ($0.01)
- **Blended cost: ~$0.004/query (2x instead of 5x)**

**Performance:**
- Standard RAG: ~2-3 seconds
- Agentic RAG: ~8-15 seconds (3-5 iterations)
- Adaptive routing: ~3-10 seconds average

---

## 9. Comparison to DocsGPT Agentic RAG

### DocsGPT Implementation (from PRD)

**Architecture:**
- **Backend**: Python + Flask + MongoDB + Celery
- **Agents**: ClassicAgent (5-step), ReActAgent (iterative reasoning)
- **Tools**: DuckDuckGo, Brave, Memory, Todo, Telegram, Webpage Reader, PostgreSQL, MCP
- **Retrievers**: Classic, LongContext
- **Orchestration**: StreamProcessor (agent creation), LLMHandler (tool orchestration)
- **Storage**: MongoDB (config, conversations), Vector stores (FAISS, Elasticsearch, Qdrant, Milvus, LanceDB)

**Key Patterns Used:**
1. **Agent Factory Pattern**: AgentCreator dynamically creates ClassicAgent or ReActAgent
2. **Tool Manager**: Dynamic tool loading from filesystem, user-isolated memory tools
3. **Configuration-Driven**: Agent configs stored in MongoDB (sources, tools, prompts, limits)
4. **Streaming SSE**: Real-time updates for answer, sources, tool_calls, thoughts
5. **Usage Limits**: Token/request limits with 24-hour rolling window

### Our App vs DocsGPT

| Feature | DocsGPT | Our App (Current) | Agentic RAG (Proposed) |
|---------|---------|-------------------|------------------------|
| **Architecture** | Backend (Python) | Browser-only (React) | Browser-only (React + Worker) |
| **Storage** | MongoDB + Vector DBs | PGlite (IndexedDB) | PGlite (IndexedDB) |
| **Agents** | ClassicAgent, ReActAgent | None | ReAct agent (OpenAI function calling) |
| **Tools** | 8+ tools (search, memory, SQL, etc.) | 2 (vector, BM25) | 3-5 (vector, BM25, web, calculate) |
| **Orchestration** | StreamProcessor (complex) | useChat hook | Agent worker (simple) |
| **Streaming** | SSE (server-sent events) | OpenAI streaming | OpenAI streaming + worker events |
| **Configuration** | MongoDB collections | localStorage | localStorage |
| **Multi-User** | Yes (MongoDB user isolation) | No (single-user browser) | No (single-user browser) |
| **Tool Isolation** | User-scoped memory tools | N/A | Not needed (single-user) |
| **Webhooks** | Celery background jobs | N/A | Not applicable (no backend) |
| **Sharing** | Public/private agent sharing | N/A | Not applicable |

### Lessons from DocsGPT

**Applicable Patterns for Browser Implementation:**

1. **Agent Factory Pattern** ✅
   - Adapt: Use `agentMode` flag to switch between StandardRAG and AgenticRAG
   - Simpler than DocsGPT (only 2 modes vs multiple agent types)

2. **Tool Manager** ✅
   - Adapt: Define tools as object map with executor functions
   - Browser-compatible tools only (no server-side tools)

3. **Streaming with Metadata** ✅
   - Adopt: Stream not just text, but also thoughts, tool calls, sources
   - Use same event types: `{ type: "thought" | "tool_call" | "answer" | "source" }`

4. **Configuration Storage** ✅
   - Adapt: Use localStorage instead of MongoDB
   - Simpler schema (no multi-user, no sharing)

5. **ReAct Agent Loop** ✅
   - Adopt: Max iterations, tool execution, observation, final answer
   - Implement with OpenAI function calling (no LangChain needed)

**Not Applicable (Backend-Specific):**
- ❌ Multi-user support
- ❌ Webhook integration
- ❌ Celery background jobs
- ❌ Agent sharing
- ❌ Usage limits (enforced server-side)

---

## 10. References & Further Reading

### Academic Papers

1. **Agentic Retrieval-Augmented Generation: A Survey** (2025)
   - arXiv: [2501.09136](https://arxiv.org/abs/2501.09136)
   - Comprehensive taxonomy of agentic RAG architectures
   - Applications in healthcare, finance, education

2. **ReAct: Synergizing Reasoning and Acting in Language Models** (2022)
   - Introduces ReAct pattern (Thought → Action → Observation)
   - Foundation for modern agentic workflows

3. **Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection** (2023)
   - Self-reflective RAG with retrieval on-demand
   - Hallucination detection through self-critique

### Implementation Guides

4. **Top 7 Agentic RAG System Architectures** - Analytics Vidhya
   - URL: https://www.analyticsvidhya.com/blog/2025/01/agentic-rag-system-architectures/
   - Detailed breakdowns of 7 patterns with use cases

5. **Traditional RAG vs Agentic RAG** - NVIDIA Developer Blog
   - URL: https://developer.nvidia.com/blog/traditional-rag-vs-agentic-rag-why-ai-agents-need-dynamic-knowledge-to-get-smarter/
   - Architecture comparison, capabilities analysis

6. **Building a Custom RAG Agent** - LangChain Docs
   - URL: https://docs.langchain.com/oss/python/langgraph/agentic-rag
   - LangGraph implementation with ReAct pattern
   - Graph structure, state management, tool integration

7. **Agentic RAG Tutorial** - DataCamp
   - URL: https://www.datacamp.com/tutorial/agentic-rag-tutorial
   - Step-by-step implementation with code examples

### Browser-Based RAG

8. **Building a Browser-Based RAG System with WebGPU** - DEV Community
   - URL: https://dev.to/emanuelestrazzullo/building-a-browser-based-rag-system-with-webgpu-h2n
   - Complete client-side RAG with WebLLM, Transformers.js, IndexedDB
   - Privacy-first architecture

9. **In-Browser Semantic Search with PGlite** - Supabase Blog
   - URL: https://supabase.com/blog/in-browser-semantic-search-pglite
   - PGlite + pgvector implementation (similar to our stack)

### OpenAI Function Calling

10. **OpenAI Function Calling Guide**
    - URL: https://platform.openai.com/docs/guides/function-calling
    - Official documentation for tool use

11. **Streaming Function Calls** - OpenAI Node SDK
    - URL: https://github.com/openai/openai-node/blob/master/examples/function-call-stream.ts
    - Example code for streaming with tool calls

### Frameworks

12. **LangGraph Documentation**
    - URL: https://langchain-ai.github.io/langgraphjs/
    - Stateful agent workflows with cycles

13. **LangChain Documentation**
    - URL: https://js.langchain.com/docs
    - Modular components for LLM applications

### GitHub Repositories

14. **AgenticRAG Survey** - GitHub
    - URL: https://github.com/asinghcsu/AgenticRAG-Survey
    - Curated list of agentic RAG papers and implementations

15. **RAGFlow** - InfiniFlow
    - URL: https://github.com/infiniflow/ragflow
    - Open-source RAG engine with agent capabilities

---

## 11. Conclusion

**Key Takeaways:**

1. **Agentic RAG is the next evolution** from static retrieval-augmented generation to dynamic, reasoning-enabled systems with planning, reflection, and self-correction.

2. **Browser implementation is viable** using OpenAI function calling API, Web Workers, and IndexedDB—perfectly aligned with our zero-backend architecture.

3. **Start simple, iterate**: Begin with basic ReAct loop (3 tools: vector_search, web_search, final_answer), then add reflection, planning, and adaptive routing.

4. **Recommended architecture**: Hybrid Corrective RAG + Self-Route for cost efficiency and quality improvement on user-uploaded documents.

5. **Quick wins available**: Basic agent with thought visualization can be implemented in 3-5 days, providing immediate value for complex queries.

6. **Cost-performance trade-off**: Agentic RAG is 5x more expensive but adaptive routing reduces blended cost to 2x with significant accuracy gains for complex queries.

**Next Steps:**

1. Review this research report and identify questions/concerns
2. Create phase-wise implementation specification (similar to `pglite-rag-pipeline.md`)
3. Prototype basic ReAct agent (Phase agentic-foundation)
4. User testing with complex queries to validate improvement
5. Iterate based on feedback

**Success Criteria:**

- ✅ Complex queries (comparisons, analysis) answered accurately
- ✅ Agent reasoning visible to users (thought bubbles)
- ✅ Cost remains under 3x current cost (via adaptive routing)
- ✅ Response time under 15 seconds for complex queries
- ✅ Zero backend dependencies maintained
- ✅ Seamless integration with existing hybrid search

This research provides the foundation for transforming our browser-based RAG app from a static retrieval system into an intelligent, reasoning-enabled agentic application.
