//utils.ts
import { ChatOpenAI } from "@langchain/openai";
import { initChatModel } from "langchain/chat_models/universal";

/**
 * Load a chat model from a fully specified name.
 * @param fullySpecifiedName - String in the format 'provider/model' or 'provider/account/provider/model'.
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(fullySpecifiedName: string) {
  const index = fullySpecifiedName.indexOf("/");

  // Handle DeepSeek models
  if (fullySpecifiedName.startsWith("deepseek/")) {
    const model = fullySpecifiedName.split("/")[1];
    return new ChatOpenAI({
      modelName: model,
      openAIApiKey: process.env.DEEPSEEK_API_KEY,
      configuration: {
        baseURL: "https://api.deepseek.com/v1",
      },
    });
  }

  if (index === -1) {
    return await initChatModel(fullySpecifiedName);
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);
    return await initChatModel(model, { modelProvider: provider });
  }
}
