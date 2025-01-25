//tools/search_guideline.ts
/**
 * This file defines the tools available to the ReAct agent.
 * Tools are functions that the agent can use to interact with external systems or perform specific tasks.
 */
import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";

const INDEX_NAME = "medical-guidelines";
const NAMESPACE = "asthma";

// Get environment variables with fallbacks
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Tool for searching medical guidelines stored in a vector database
 * @class GuidelineSearchTool
 * @extends {Tool}
 */
export class GuidelineSearchTool extends Tool {
  name = "search_guidelines";
  description =
    "Searches the asthma medical guidelines for relevant information.";
  pineconeClient: Pinecone;
  embeddings: OpenAIEmbeddings;

  constructor() {
    if (!PINECONE_API_KEY || !OPENAI_API_KEY) {
      throw new Error("Missing required environment variables");
    }
    super();
    this.pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
  }

  /**
   * Searches the medical guidelines using semantic similarity
   * @param {string} query - The search query
   * @param {any} config - The configuration object
   * @returns {Promise<Command>} A Command with just the content string and needsReasoning flag
   * @throws {Error} If there's an issue connecting to Pinecone or processing embeddings
   */
  async _call(
    query: string,
    _runManager: CallbackManagerForToolRun,
    config: ToolRunnableConfig,
  ): Promise<Command> {
    try {
      const toolCallId = config?.toolCall?.id || "default_tool_call";

      const index = this.pineconeClient.index(INDEX_NAME);
      const [queryEmbedding] = await this.embeddings.embedDocuments([query]);

      const results = await index.namespace(NAMESPACE).query({
        vector: queryEmbedding,
        topK: 3,
        includeMetadata: true,
      });

      const formattedResults = results.matches
        .map((match, i) => {
          const metadata = match.metadata as { text: string; heading?: string };
          const context = metadata.heading ? `[${metadata.heading}] ` : "";
          console.log(
            `[GuidelineSearchTool] Match ${i + 1} score: ${match.score}`,
          );
          return `${context}${metadata.text}`;
        })
        .join("\n\n");

      const content =
        formattedResults || "No relevant information found in the guidelines.";

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content,
              tool_call_id: toolCallId,
            }),
          ],
          needsReasoning: true,
        },
      });
    } catch (error) {
      console.error("[GuidelineSearchTool] Error during search:", error);
      const toolCallId = config?.toolCall?.id || "default_tool_call";

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: "Error searching the medical guidelines.",
              tool_call_id: toolCallId,
            }),
          ],
          needsReasoning: false,
        },
      });
    }
  }
}
