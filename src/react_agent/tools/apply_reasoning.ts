import { loadChatModel } from "../utils.js";

import { USE_REASONING_PROMPT } from "../prompts.js";
import { MessagesAnnotation } from "@langchain/langgraph";
import { Tool } from "@langchain/core/tools";

export class ApplyReasoningTool extends Tool {
  name = "apply_reasoning";
  description = "Apply reasoning to the sentence.";

  async _call(input: string): Promise<typeof MessagesAnnotation.Update> {
    const model = await loadChatModel("deepseek/deepseek-chat");

    const systemMessage = {
      role: "system",
      content: USE_REASONING_PROMPT,
    };

    // Generate analysis
    const response = await model.invoke([systemMessage, input]);

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
