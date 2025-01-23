import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Pinecone, RecordMetadata } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";

console.log("[Indexer] Starting indexing process");
dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// One index for all medical guidelines
const INDEX_NAME = "medical-guidelines";
// Namespace for this specific guideline
const NAMESPACE = "asthma";

function cleanMetadata(metadata: ChunkMetadata): RecordMetadata {
  console.log("[Indexer] Cleaning metadata:", metadata);
  const clean: RecordMetadata = {};

  if (metadata.text) clean.text = metadata.text;
  if (metadata.pageNumber) clean.pageNumber = metadata.pageNumber.toString();

  console.log("[Indexer] Cleaned metadata:", clean);
  return clean;
}

interface ChunkMetadata {
  pageNumber?: number;
  text?: string;
}

async function convertPdfToChunks(pdfPath: string) {
  console.log(`[Indexer] Loading PDF from: ${pdfPath}`);
  const loader = new PDFLoader(pdfPath, {
    splitPages: true,
  });

  const docs = await loader.load();
  console.log(`[Indexer] Loaded ${docs.length} pages`);

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 800,
  });

  // Use the page number from PDFLoader's metadata
  const docsWithMetadata = docs.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      pageNumber: doc.metadata?.loc?.pageNumber || undefined,
    },
  }));

  const chunks = await textSplitter.splitDocuments(docsWithMetadata);
  console.log(`[Indexer] Created ${chunks.length} chunks`);
  return chunks;
}

async function uploadChunksToPinecone(chunks: Document<ChunkMetadata>[]) {
  if (!PINECONE_API_KEY || !OPENAI_API_KEY) {
    throw new Error("Missing required environment variables");
  }
  console.log("[Indexer] Initializing Pinecone");
  const pc = new Pinecone({
    apiKey: PINECONE_API_KEY,
  });

  try {
    console.log("[Indexer] Creating index if it doesn't exist");
    await pc.createIndex({
      name: INDEX_NAME,
      dimension: 1536,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    console.log("[Indexer] Index created or already exists");
  } catch (e) {
    console.log("[Indexer] Index creation result:", e);
  }

  const index = pc.index(INDEX_NAME);

  console.log("[Indexer] Creating embeddings");
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: OPENAI_API_KEY,
    model: "text-embedding-3-small",
  });

  console.log("[Indexer] Converting chunks to embeddings");
  const vectors = await embeddings.embedDocuments(
    chunks.map((doc) => doc.pageContent),
  );
  console.log(`[Indexer] Created ${vectors.length} embeddings`);

  const records = chunks.map((chunk, i) => ({
    id: `chunk-${i}`,
    values: vectors[i],
    metadata: cleanMetadata({
      text: chunk.pageContent,
      pageNumber: chunk.metadata.pageNumber,
    }),
  }));

  const batchSize = 100;
  console.log(`[Indexer] Upserting in batches of ${batchSize}`);
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(
      `[Indexer] Upserting batch ${i / batchSize + 1} of ${Math.ceil(records.length / batchSize)}`,
    );
    await index.namespace(NAMESPACE).upsert(batch);
  }

  const stats = await index.describeIndexStats();
  console.log("[Indexer] Final index stats:", stats);
}

export async function indexGuidelines() {
  try {
    const topic = "asthma";
    const guidelinePath = path.join(
      process.cwd(),
      "input",
      topic,
      "guideline",
      `${topic}_guideline.pdf`,
    );

    console.log(`[Indexer] Starting indexing process for: ${guidelinePath}`);
    if (!fs.existsSync(guidelinePath)) {
      console.error(`[Indexer] PDF not found at ${guidelinePath}`);
      process.exit(1);
    }

    const chunks = await convertPdfToChunks(guidelinePath);
    await uploadChunksToPinecone(chunks);
    console.log("[Indexer] Indexing completed successfully");
    return true;
  } catch (error) {
    console.error("[Indexer] Error during indexing:", error);
    throw error;
  }
}

if (
  import.meta.url === new URL(import.meta.resolve("./index_guidelines.ts")).href
) {
  console.log("[Indexer] Running as script");
  indexGuidelines().catch(console.error);
}
