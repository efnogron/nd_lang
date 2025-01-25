//graph.ts
import { AIMessage } from "@langchain/core/messages";
import {
  Annotation,
  Command,
  MessagesAnnotation,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { RunnableConfig } from "@langchain/core/runnables";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { FetchNextSentenceTool } from "./tools/fetch_next_sentence.js";
import { GuidelineSearchTool } from "./tools/search_guideline.js";
import { loadChatModel } from "./utils.js";
import { MASTER_AGENT_PROMPT } from "./prompts.js";
import { applyReasoningNode } from "./tools/apply_reasoning.js";
import { AnalysisOutput, ArticleSentence } from "./types.js";

// Define our state schema using Annotation.Root
export const AgentStateSchema = Annotation.Root({
  // Include all fields from MessagesAnnotation
  ...MessagesAnnotation.spec,
  // Add our custom needsReasoning field
  needsReasoning: Annotation<boolean>(),
  article: Annotation<ArticleSentence>(),
  analysisOutput: Annotation<AnalysisOutput>(),
});

// Define the function that calls the model
async function masterAgent(
  state: typeof AgentStateSchema.State,
  config: RunnableConfig,
) {
  const configuration = ensureConfiguration(config);
  const messages = state.messages;

  if (state.needsReasoning) {
    console.log("[Graph] Needs reasoning, using DeepSeek model first");
    // First use DeepSeek for reasoning
    return new Command({
      goto: "apply_reasoning",
    });
  }

  // Then use the main model for tool calling
  const modelWithTools = (await loadChatModel(configuration.model)).bindTools([
    new FetchNextSentenceTool(),
    new GuidelineSearchTool(),
  ]);

  const systemMessage = {
    role: "system",
    content: MASTER_AGENT_PROMPT,
  };

  const response = await modelWithTools.invoke([systemMessage, ...messages]);

  return {
    messages: [response],
    needsReasoning: false, // Reset the flag after handling reasoning
  };
}

// Define the function that determines whether to continue or not
function routeModelOutput(state: typeof MessagesAnnotation.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  console.log("[Graph] Routing model output. Last message:", lastMessage);

  if (!lastMessage.tool_calls?.length) {
    console.log("[Graph] No tool calls, routing to end");
    return "__end__";
  }

  // The tool name must exactly match the node name we defined in the graph
  const toolName = lastMessage.tool_calls[0].name;
  // Only allow routing to fetch_nextsentence or guidelinetool from masterAgent
  if (toolName === "fetch_next_sentence") {
    return "fetch_nextsentence";
  } else if (toolName === "search_guidelines") {
    return "guidelinetool";
  } else if (toolName === "analyze_sentence") {
    // This should never happen as analyze_sentence is only called from fetch_nextsentence
    console.warn("[Graph] Unexpected direct call to analyze_sentence");
    return "__end__";
  }

  return "__end__";
}

// Create instances of our tools
const guidelineNode = new ToolNode([new GuidelineSearchTool()]);
const sentenceNode = new ToolNode([new FetchNextSentenceTool()]);
// Define a new graph. We use the prebuilt MessagesAnnotation to define state:
// https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagesannotation
console.log("[Graph] Initializing workflow");
const workflow = new StateGraph(AgentStateSchema, ConfigurationSchema)
  .addNode("masterAgent", masterAgent)
  .addNode("guidelinetool", guidelineNode)
  .addNode("fetch_nextsentence", sentenceNode)
  .addNode("apply_reasoning", applyReasoningNode)
  .addEdge("__start__", "masterAgent")
  .addEdge("guidelinetool", "masterAgent")
  .addEdge("fetch_nextsentence", "masterAgent")
  .addEdge("apply_reasoning", "masterAgent")
  .addConditionalEdges("masterAgent", routeModelOutput);

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
console.log("[Graph] Compiling workflow");

export const graph = workflow.compile({
  interruptBefore: [],
  interruptAfter: [],
});
console.log("[Graph] Workflow compiled");
