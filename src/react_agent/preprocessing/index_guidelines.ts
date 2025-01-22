import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { ChromaClient } from "chromadb";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  try {
    const topic = "asthma";
    const guidelinePath = path.join(
      process.cwd(),
      "input",
      topic,
      "guideline",
      `${topic}_guideline.pdf`,
    );

    console.log(`Looking for PDF at: ${guidelinePath}`);

    if (!fs.existsSync(guidelinePath)) {
      console.error(`PDF not found at ${guidelinePath}`);
      process.exit(1);
    }

    const loader = new PDFLoader(guidelinePath);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} pages`);

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await textSplitter.splitDocuments(docs);
    console.log(`Created ${chunks.length} chunks`);

    const embeddings = new OpenAIEmbeddings();

    // Initialize Chroma client
    const client = new ChromaClient();

    // Create or get collection
    const collection = await client.getOrCreateCollection({
      name: `${topic}_guidelines`,
    });

    // Create unique IDs for each chunk
    const ids = chunks.map((_, index) => `chunk_${index}`);
    const texts = chunks.map((chunk) => chunk.pageContent);
    const metadatas = chunks.map((chunk) => chunk.metadata);
    const embeddingsArray = await embeddings.embedDocuments(texts);

    await collection.add({
      ids: ids, // Now using unique IDs instead of file path
      embeddings: embeddingsArray,
      metadatas: metadatas,
      documents: texts,
    });

    console.log("Done! Vector store created successfully.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
