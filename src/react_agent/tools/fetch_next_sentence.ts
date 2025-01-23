// src/react_agent/tools/fetch_next_sentence.ts
import { Tool } from "@langchain/core/tools";
import fs from "fs";
import path from "path";

export class FetchNextSentenceTool extends Tool {
  name = "fetch_next_sentence";
  description =
    "Fetches the next sentence and its context from the processed article";

  private currentIndex = 0;
  private sentences: any[] = [];

  constructor() {
    super();
    // Load the processed article
    const articlePath = path.join(
      process.cwd(),
      "input",
      "asthma",
      "article",
      "processed_article.json",
    );
    const article = JSON.parse(fs.readFileSync(articlePath, "utf-8"));
    this.sentences = article.sentences;
  }

  async _call(): Promise<string> {
    if (this.currentIndex >= this.sentences.length) {
      return "No more sentences available.";
    }

    const sentence = this.sentences[this.currentIndex];
    this.currentIndex++;

    return JSON.stringify(
      {
        text: sentence.text,
        context: sentence.context,
        metadata: sentence.metadata,
        position: `${this.currentIndex}/${this.sentences.length}`,
      },
      null,
      2,
    );
  }
}
