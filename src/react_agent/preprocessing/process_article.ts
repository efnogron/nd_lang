import fs from "fs";
import path from "path";
import nlp from "compromise";
import de from "compromise-sentences";
import { v4 as uuidv4 } from "uuid";

nlp.extend(de as any);

interface ArticleSentence {
  id: string;
  text: string;
  context: {
    section: string;
    subsection?: string;
    paragraph: string;
  };
  metadata: {
    isBulletPoint: boolean;
    isHeading: boolean;
  };
}

interface ProcessedArticle {
  metadata: {
    title: string;
    language: string;
    processingDate: string;
  };
  sentences: ArticleSentence[];
}

function splitIntoSentences(text: string): string[] {
  const doc = nlp(text);
  return doc.sentences().out("array");
}

async function processArticle() {
  try {
    const articlePath = path.join(
      process.cwd(),
      "input",
      "asthma",
      "article",
      "article.md",
    );

    console.log(`[ArticleProcessor] Loading article from: ${articlePath}`);
    const content = fs.readFileSync(articlePath, "utf-8");

    const processedArticle: ProcessedArticle = {
      metadata: {
        title: "Asthma Article",
        language: "de",
        processingDate: new Date().toISOString(),
      },
      sentences: [],
    };

    let currentSection = "";
    let currentSubsection = "";

    // Split content into paragraphs
    const paragraphs = content.split(/\n\n+/);

    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      // Check if this is a header
      if (paragraph.startsWith("## ")) {
        currentSection = paragraph.replace(/^## /, "").trim();
        currentSubsection = "";
        processedArticle.sentences.push({
          id: uuidv4(),
          text: currentSection,
          context: {
            section: currentSection,
            paragraph: paragraph,
          },
          metadata: {
            isBulletPoint: false,
            isHeading: true,
          },
        });
        continue;
      }

      if (paragraph.startsWith("### ")) {
        currentSubsection = paragraph.replace(/^### /, "").trim();
        processedArticle.sentences.push({
          id: uuidv4(),
          text: currentSubsection,
          context: {
            section: currentSection,
            subsection: currentSubsection,
            paragraph: paragraph,
          },
          metadata: {
            isBulletPoint: false,
            isHeading: true,
          },
        });
        continue;
      }

      const isBulletPoint = paragraph.trim().startsWith("-");

      // Use compromise to split into sentences
      const sentences = splitIntoSentences(paragraph);

      for (const sentence of sentences) {
        if (!sentence.trim()) continue;

        processedArticle.sentences.push({
          id: uuidv4(),
          text: sentence.trim(),
          context: {
            section: currentSection,
            ...(currentSubsection && { subsection: currentSubsection }),
            paragraph: paragraph,
          },
          metadata: {
            isBulletPoint,
            isHeading: false,
          },
        });
      }
    }

    const outputPath = path.join(
      process.cwd(),
      "input",
      "asthma",
      "article",
      "processed_article.json",
    );

    fs.writeFileSync(outputPath, JSON.stringify(processedArticle, null, 2));
    console.log(`[ArticleProcessor] Saved processed article to: ${outputPath}`);

    return processedArticle;
  } catch (error) {
    console.error("[ArticleProcessor] Error processing article:", error);
    throw error;
  }
}

if (
  import.meta.url === new URL(import.meta.resolve("./process_article.ts")).href
) {
  console.log("[ArticleProcessor] Running as script");
  processArticle().catch(console.error);
}

export { processArticle };
