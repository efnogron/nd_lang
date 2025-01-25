import { loadChatModel } from "../utils.js";
import { USE_REASONING_PROMPT } from "../prompts.js";
import { AgentStateSchema } from "../graph.js";
import { AIMessage } from "@langchain/core/messages";

/**
 * used to evaluate if the statement is valid based on the provided guidelines and conversation history
 * @param {typeof AgentStateSchema.State} state - State of the agent
 * @returns {Promise<typeof AgentStateSchema.Update>} The updated state
 */
export async function applyReasoningNode(
  state: typeof AgentStateSchema.State,
): Promise<typeof AgentStateSchema.Update> {
  const model = await loadChatModel("deepseek/deepseek-chat");
  const systemMessage = {
    role: "system",
    content: USE_REASONING_PROMPT,
  };

  const response = await model.invoke([systemMessage, ...state.messages]);
  console.log("[ApplyReasoningNode] Response:", response);
  return {
    messages: [new AIMessage({ content: response.content })],
    needsReasoning: false,
  };
}
