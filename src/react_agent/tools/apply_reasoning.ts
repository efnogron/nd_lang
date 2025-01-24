import { loadChatModel } from "../utils.js";

import { USE_REASONING_PROMPT } from "../prompts.js";
import { MessagesAnnotation } from "@langchain/langgraph";
import { Tool } from "@langchain/core/tools";

export class ApplyReasoningTool extends Tool {
  name = "apply_reasoning";
  description = "use this to evaluate if the sentence is valid or not. pass in the statement that is to be verified.";

  async _call(state: typeof MessagesAnnotation.State): Promise<typeof MessagesAnnotation.Update> {
    const model = await loadChatModel("deepseek/deepseek-chat");

    const systemMessage = {
      role: "system",
      content: USE_REASONING_PROMPT,
    };

    // Generate analysis
    const response = await model.invoke([systemMessage, ...state.messages]);

    return {
      messages: [
        {
          role: "system",
          content: `Analysis:\n${response.content}`,
        },
      ],
    };
  }
}
