//tools/fetch_next_sentence.ts
import path from "path";

import { Tool, ToolRunnableConfig } from "@langchain/core/tools";
import fs from "fs/promises";
import { ArticleSentence, ProcessedArticle } from "../types.js";
import { loadChatModel } from "../utils.js";
import { ANALYZE_SENTENCE_PROMPT } from "../prompts.js";
import { z } from "zod";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { AnalysisOutput } from "../types.js";


export class FetchNextSentenceTool extends Tool {
  name = "fetch_next_sentence";
  description =
    "Fetches the next sentence from the article that needs verification.";
  private currentIndex = 0;
  private articleContent: ProcessedArticle | null = null;

  async loadArticleIfNeeded(): Promise<void> {
    if (this.articleContent === null) {
      const filePath = path.join(
        process.cwd(),
        "input",
        "asthma",
        "article",
        "processed_article.json",
      );
      const fileContent = await fs.readFile(filePath, "utf-8");
      this.articleContent = JSON.parse(fileContent);
      console.log(
        `[FetchNextSentenceTool] Loaded ${this.articleContent?.sentences.length} sentences`,
      );
    }
  }

  async analyzeSentence(sentence: ArticleSentence): Promise<{
    analysisOutput: AnalysisOutput;
    filledPrompt: string;
  }> {
    console.log("[FetchNextSentenceTool] Sentence text:", sentence.text);

    const filledPrompt = ANALYZE_SENTENCE_PROMPT.replace(
      "{section}",
      sentence.context.section,
    )
      .replace("{subsection}", sentence.context.subsection || "")
      .replace("{paragraph}", sentence.context.paragraph)
      .replace("{sentence}", sentence.text);

    const analysisSchema = z.object({
      query: z
        .string()
        .nullable()
        .describe("The verification query or null if no verification needed"),
      reasoning: z
        .string()
        .describe("Explanation why this needs verification or not"),
      needs_verification: z
        .boolean()
        .describe("Whether this sentence needs to be verified"),
    });

    const model = (
      await loadChatModel("gpt-4o-mini")
    ).withStructuredOutput<AnalysisOutput>(analysisSchema, {
      name: "analyze_sentence",
    });

    try {
      const response = await model.invoke([
        {
          role: "system",
          content: filledPrompt,
        },
      ]);

      console.log("[FetchNextSentenceTool] Generated output:", response);
      return {
        analysisOutput: response,
        filledPrompt,
      };
    } catch (e) {
      console.error(
        "[FetchNextSentenceTool] Error parsing analysis output:",
        e,
      );
      return {
        analysisOutput: {
          query: null,
          reasoning: "",
          needs_verification: false,
        },
        filledPrompt,
      };
    }
  }

  async _call(
    _: string,
    _runManager?: CallbackManagerForToolRun,
    config?: ToolRunnableConfig,
  ): Promise<Command> {
    console.log("[FetchNextSentenceTool] Starting fetch");
    await this.loadArticleIfNeeded();

    if (!this.articleContent) {
      throw new Error("Article content not loaded");
    }

    // Keep fetching sentences until we find one that needs verification
    // or reach the end of the article
    while (this.currentIndex < this.articleContent.sentences.length) {
      const currentSentence = this.articleContent.sentences[this.currentIndex];
      this.currentIndex++;

      const { analysisOutput, filledPrompt } =
        await this.analyzeSentence(currentSentence);

      if (!analysisOutput.needs_verification) {
        console.log(
          "[FetchNextSentenceTool] Sentence does not need verification, continuing...",
        );
        continue;
      }

      console.log(
        "[FetchNextSentenceTool] Found sentence needing verification:",
        currentSentence.id,
      );

      const toolCallId = config?.toolCall?.id || "default_tool_call";

      return new Command({
        update: {
          messages: [
            new ToolMessage({
              content: `System Prompt:
${filledPrompt}

Generierte Query: ${analysisOutput.query}
Begründung: ${analysisOutput.reasoning}

Bitte überprüfen Sie diese Aussage mithilfe der Leitlinie.`,
              tool_call_id: toolCallId,
              name: "fetch_next_sentence",
            }),
          ],
          article: currentSentence,
          analysisOutput: analysisOutput,
        },
      });
    }

    // End of article reached
    const toolCallId = config?.toolCall?.id || "default_tool_call";
    return new Command({
      update: {
        messages: [
          new ToolMessage({
            content: "Ende des Artikels erreicht.",
            tool_call_id: toolCallId,
            name: "fetch_next_sentence",
          }),
        ],
        article: null,
        analysisOutput: {
          query: null,
          reasoning: "Ende des Artikels erreicht.",
          needs_verification: false,
        },
      },
    });
  }
}
