//graph.ts
import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { FetchNextSentenceTool } from "./tools/fetch_next_sentence.js";
import { GuidelineSearchTool } from "./tools/search_guideline.js";
import { loadChatModel } from "./utils.js";
import { MASTER_AGENT_PROMPT } from "./prompts.js";
import { applyReasoningNode } from "./tools/apply_reasoning.js";

// Define the function that calls the model
async function masterAgent(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = ensureConfiguration(config);

  const model = (await loadChatModel(configuration.model)).bindTools([
    new FetchNextSentenceTool(),
    new GuidelineSearchTool(),
    applyReasoningNode,
  ]);

  const systemMessage = {
    role: "system",
    content: MASTER_AGENT_PROMPT,
  };

  const response = await model.invoke([systemMessage, ...state.messages]);

  return {
    messages: [response],
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
  } else if (toolName === "apply_reasoning") {
    return "apply_reasoning";
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
const workflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  .addNode("masterAgent", masterAgent)
  .addNode("apply_reasoning", applyReasoningNode)
  .addNode("guidelinetool", guidelineNode)
  .addNode("fetch_nextsentence", sentenceNode)
  .addEdge("__start__", "masterAgent")
  .addEdge("apply_reasoning", "masterAgent")
  .addEdge("guidelinetool", "masterAgent")
  .addEdge("fetch_nextsentence", "masterAgent")
  .addConditionalEdges("masterAgent", routeModelOutput);

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
console.log("[Graph] Compiling workflow");

export const graph = workflow.compile({
  interruptBefore: [],
  interruptAfter: [],
});
console.log("[Graph] Workflow compiled");
