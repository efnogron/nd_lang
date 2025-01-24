// import { loadChatModel } from "../utils.js";
// import { USE_REASONING_PROMPT } from "../prompts.js";
// import { MessagesAnnotation } from "@langchain/langgraph";

// export async function applyReasoningNode(
//   state: typeof MessagesAnnotation.State
// ): Promise<typeof MessagesAnnotation.Update> {
//   const model = await loadChatModel("deepseek/deepseek-chat");
//   const systemMessage = {
//     role: "system",
//     content: USE_REASONING_PROMPT,
//   };

//   const response = await model.invoke([systemMessage, ...state.messages]);

//   return {
//     messages: [
//       {
//         role: "system",
//         content: `Analysis:\n${response.content}`,
//       },
//     ],
//   };
// }
