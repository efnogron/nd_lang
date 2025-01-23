# Langchain ReAct Agent

## Agent Initialization

- Access to pre-indexed guideline vector store
- Access to pre-processed article sentences with context

## Master Agent

Single ReAct agent that processes one sentence at a time to verify medical claims.
Purpose: Coordinates the entire verification process including query formulation, evidence assessment, and human interaction.
Flow:

- fetches next sentence + context from stored article structure using fetch_sentence_tool
- formulates search queries
- uses vector search tool to find relevant guideline sections using search_guidelines tool
- assesses evidence against the claim
- presents findings to human operator in chat
- waits for human feedback/decision
- adapts based on human input (e.g., reformulate query, search again)
- proceeds to next sentence only upon human confirmation

## Tools

### search_guidelines Tool

Purpose: Find relevant sections in the medical guidelines
Task:

- Execute semantic search in the pre-indexed guideline vector store on pinecone
- Return the most relevant guideline sections

## Human Interaction

The agent operates in LangGraph Studio's UI, providing:

- Visibility of all tool calls and their results
- Detailed view of the verification process
- Natural language chat interface

### Human Interaction Options

Users can:

- Review the agent's verification process in real-time
- Provide natural language feedback on queries or evidence
- Request additional searches
- Guide the verification process
- Control when to proceed to the next sentence

### Example Interactions

- "Please try searching with different keywords"
- "This evidence isn't relevant enough, search again"
- "This verification looks good, proceed to next sentence"
- "Skip this sentence, it's not a medical claim"

## State Management

### Pre-Agent State (Persistent)

- Access to pre-indexed guideline vector store
- Access to pre-processed article sentences with context

### Per-Sentence Processing State

#### 1. Current Sentence State

```typescript
{
  sentence: string;
  context: {
    heading: string;
    subheading: string;
    paragraph: string;
  }
}
```

Purpose: Contains the current sentence being analyzed and its context from the article
Reset: After sentence verification is complete

#### 2. Search State

```typescript
{
  retrievedGuidelines: {
    content: string;
    metadata: {
      source: string;
      score: number;
    }
  }
  [];
}
```

Purpose: Stores relevant guideline sections found during search
Reset: After verification is complete

#### 3. Verification Result State

```typescript
{
  status: "VALID" | "FLAGGED" | "UNCLEAR";
  confidence: number;
  evidence: string[];
  reasoning: string;
}
```

Purpose: Contains the final verification result for the sentence
Reset: After results are formatted and stored

## State Flow

1. **Start New Sentence**

   - fetches next sentence and context
   - previous sentence state is cleared

2. **Search and Verify**

   - Agent formulates query and searches guidelines
   - Agent assesses evidence
   - Present to human for review

3. **Human Interaction**

   - If approved: proceed to next sentence
   - If rejected: agent reformulates and searches again

## Implementation Checklist

## 1. Pre-Processing Setup

- [x] Convert guideline PDF to vector store
- uses index_guidelines.ts
- uses pinecone
- runs from CLI, not from LangGraph Studio

- [x] Process article into sentence format
  - Split into sentences while preserving context
  - uses process_article.ts
  - stores processed article in input/[topic]/article/processed_article.json
  - article is stored in structured format:

```json
{
  "metadata": {
    "title": string,
    "language": string,
    "processingDate": ISO-8601 date
  },
  "sentences": [
    {
      "id": UUID,
      "text": string,
      "context": {
        "section": string,
        "subsection": string (optional),
        "paragraph": string
      },
      "metadata": {
        "isBulletPoint": boolean,
        "isHeading": boolean
      }
    }
  ]
}
```

## 2. Vector Search Tool

- [x] Implement vector search tool
  ```typescript
  {
    name: "search_guidelines",
    description: "Sucht in den medizinischen Leitlinien",
    parameters: {
      query: string,
      top_k: number
    }
  }
  ```

## 3. Agent Setup

- [ ] Update system prompt for medical verification task
- [ ] Modify state management for our use case
- [ ] Implement human interaction loop
- [ ] Add sentence iteration logic

## 4. Testing

- [ ] Update integration test for new workflow
- [ ] Add test for vector search tool
- [ ] Add test for sentence processing

## 5. Configuration

- [ ] Update configuration.ts with new parameters
- [ ] Set up environment variables for vector store
