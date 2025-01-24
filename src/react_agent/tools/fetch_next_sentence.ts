//tools/fetch_next_sentence.ts
import path from "path";

import { Tool } from "@langchain/core/tools";
import fs from "fs/promises";
import { ArticleSentence, ProcessedArticle } from "../types.js";
import { loadChatModel } from "../utils.js";
import { MessagesAnnotation } from "@langchain/langgraph";
import { ANALYZE_SENTENCE_PROMPT } from "../prompts.js";
import { z } from "zod";

interface AnalysisOutput {
  query: string | null;
  reasoning: string;
  needs_verification: boolean;
}

export class FetchNextSentenceTool extends Tool {
  name = "fetch_next_sentence";
  description = "Fetches and analyzes the next sentence from the article.";
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
    needs_verification: boolean;
    query: string | null;
    reasoning: string;
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
        ...response,
        filledPrompt,
      };
    } catch (e) {
      console.error(
        "[FetchNextSentenceTool] Error parsing analysis output:",
        e,
      );
      return {
        query: null,
        reasoning: "",
        needs_verification: false,
        filledPrompt,
      };
    }
  }

  async _call(): Promise<typeof MessagesAnnotation.Update> {
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

      console.log(
        "[FetchNextSentenceTool] Checking sentence:",
        currentSentence.id,
      );

      const { needs_verification, query, reasoning, filledPrompt } =
        await this.analyzeSentence(currentSentence);

      if (!needs_verification) {
        console.log(
          "[FetchNextSentenceTool] Sentence does not need verification, continuing...",
        );
        continue;
      }

      console.log(
        "[FetchNextSentenceTool] Found sentence needing verification:",
        currentSentence.id,
      );

      return {
        messages: [
          {
            role: "system",
            content: filledPrompt,
          },
          {
            role: "assistant",
            content: `
Generierte Query: ${query}
Begründung: ${reasoning}

Bitte überprüfen Sie diese Aussage mithilfe der Leitlinie.`,
          },
        ],
      };
    }

    return {
      messages: ["Ende des Artikels erreicht."],
    };
  }
}
