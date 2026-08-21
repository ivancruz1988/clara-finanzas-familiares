import { createHash } from "node:crypto";

export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_VERSION = "v1";

export type VectorDocumentSource = "help" | "receipt" | "transaction" | "payment" | "budget" | "note";

export type VectorSectionDraft = {
  sectionIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
};

export function contentHash(value: string) {
  return createHash("sha256").update(value.trim().replace(/\s+/g," ")).digest("hex");
}

export function estimateTokenCount(value: string) {
  return Math.ceil(value.trim().split(/\s+/).filter(Boolean).length*1.35);
}

export function chunkDocument(content: string, maxWords = 220): VectorSectionDraft[] {
  const paragraphs = content.split(/\n{2,}/).map(part=>part.trim()).filter(Boolean);
  const sections: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (currentWords > 0 && currentWords + words.length > maxWords) {
      sections.push(current.join("\n\n"));
      current = [];
      currentWords = 0;
    }
    current.push(paragraph);
    currentWords += words.length;
  }
  if (current.length) sections.push(current.join("\n\n"));

  return sections.map((section,index)=>({
    sectionIndex: index,
    content: section,
    contentHash: contentHash(section),
    tokenCount: estimateTokenCount(section),
  }));
}

export function validateEmbedding(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`El embedding debe tener ${EMBEDDING_DIMENSIONS} dimensiones.`);
  }
  if (!embedding.every(Number.isFinite)) throw new Error("El embedding contiene valores invalidos.");
}
