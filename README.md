# Langchain ReAct Agent

## Agent Initialization

- Access to pre-indexed guideline vector store
- Access to pre-processed article sentences with context

## Master Agent

Single ReAct agent that processes one sentence at a time to verify medical claims.
Purpose: Coordinates the entire verification process including query formulation, evidence assessment, and human interaction.
Flow:

- is initialized with next sentence + context from stored article structure
- formulates search queries
- uses vector search tool to find relevant guideline sections
- assesses evidence against the claim
- presents findings to human operator in chat
- waits for human feedback/decision
- adapts based on human input (e.g., reformulate query, search again)
- proceeds to next sentence only upon human confirmation

## Tools

### Vector Search Tool

Purpose: Find relevant sections in the medical guidelines
Task:

- Execute semantic search in the pre-indexed guideline vector store
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

You're right. Let me simplify the state section of the README.md to match our streamlined architecture:

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

   - Load next sentence and context
   - All previous state is cleared

2. **Search and Verify**

   - Agent formulates query and searches guidelines
   - Agent assesses evidence
   - Present to human for review

3. **Human Interaction**

   - If approved: proceed to next sentence
   - If rejected: agent reformulates and searches again

4. **Reset**
   - Clear all state
   - Ready for next sentence

## Implementation Checklist
