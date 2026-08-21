import { createHash } from "node:crypto";
import type { AssistantIntent, AssistantResponse } from "@/features/assistant/contracts";
import type { AssistantFilters } from "@/features/assistant/filters";

export const SEMANTIC_REUSE_THRESHOLD = 0.94;
export const SEMANTIC_ASSIST_THRESHOLD = 0.85;

export type SemanticCacheDecision = "reuse" | "assist" | "miss";

export type SemanticCacheInput = {
  householdId: string;
  userId: string;
  message: string;
  intent: AssistantIntent;
  filters: AssistantFilters;
  dataVersion: number;
  embedding: number[];
};

export type SemanticCacheRecord = SemanticCacheInput & {
  normalizedQuery: string;
  queryHash: string;
  answerPayload: AssistantResponse;
  expiresAt: string;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .toLowerCase()
    .trim()
    .replace(/\s+/g," ");
}

function sorted(values: string[]) {
  return [...values].sort();
}

function comparableFilters(filters: AssistantFilters) {
  return {
    period: filters.period,
    accounts: sorted(filters.accounts),
    categories: sorted(filters.categories),
    status: filters.status || null,
    currency: filters.currency,
    amountMin: filters.amountMin ?? null,
    amountMax: filters.amountMax ?? null,
  };
}

export function semanticQueryHash(input: {
  householdId: string;
  userId: string;
  normalizedQuery: string;
  intent: AssistantIntent;
  filters: AssistantFilters;
  dataVersion: number;
}) {
  return createHash("sha256").update(JSON.stringify({
    householdId: input.householdId,
    userId: input.userId,
    normalizedQuery: input.normalizedQuery,
    intent: input.intent,
    filters: comparableFilters(input.filters),
    dataVersion: input.dataVersion,
  })).digest("hex");
}

export function criticalFiltersEqual(a: AssistantFilters, b: AssistantFilters) {
  return JSON.stringify(comparableFilters(a)) === JSON.stringify(comparableFilters(b));
}

export function semanticCacheDecision(input: {
  similarity: number;
  filtersEqual: boolean;
  dataVersionEqual: boolean;
}) : SemanticCacheDecision {
  if (!input.filtersEqual || !input.dataVersionEqual) return "miss";
  if (input.similarity >= SEMANTIC_REUSE_THRESHOLD) return "reuse";
  if (input.similarity >= SEMANTIC_ASSIST_THRESHOLD) return "assist";
  return "miss";
}

export function buildSemanticCacheRecord(input: SemanticCacheInput & {
  answerPayload: AssistantResponse;
  ttlSeconds?: number;
  now?: Date;
}): SemanticCacheRecord {
  const normalizedQuery = normalizeText(input.message);
  const ttlSeconds = input.ttlSeconds ?? 5*60;
  const now = input.now ?? new Date();
  return {
    householdId: input.householdId,
    userId: input.userId,
    message: input.message,
    intent: input.intent,
    filters: input.filters,
    dataVersion: input.dataVersion,
    embedding: input.embedding,
    normalizedQuery,
    queryHash: semanticQueryHash({
      householdId: input.householdId,
      userId: input.userId,
      normalizedQuery,
      intent: input.intent,
      filters: input.filters,
      dataVersion: input.dataVersion,
    }),
    answerPayload: input.answerPayload,
    expiresAt: new Date(now.getTime()+ttlSeconds*1000).toISOString(),
  };
}
