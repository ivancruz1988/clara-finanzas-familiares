import type { AssistantFilters, AssistantPeriod } from "@/features/assistant/filters";
import type { AssistantIntent, AssistantResponse } from "@/features/assistant/contracts";

type CacheEntry = {
  response: AssistantResponse;
  expiresAt: number;
  hits: number;
  createdAt: number;
};

export type AssistantCacheMetrics = {
  hits: number;
  misses: number;
  writes: number;
  size: number;
};

const TTL_MS = 5*60*1000;
const cache = new Map<string,CacheEntry>();
const metrics = {hits:0,misses:0,writes:0};

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

function periodKey(period: AssistantPeriod) {
  return `${period.label}:${period.from}:${period.to}`;
}

export function buildExactCacheKey(input: {
  householdId: string;
  userId: string;
  message: string;
  intent: AssistantIntent;
  filters: AssistantFilters;
  dataVersion: number;
}) {
  return JSON.stringify({
    householdId: input.householdId,
    userId: input.userId,
    query: normalizeText(input.message),
    intent: input.intent,
    period: periodKey(input.filters.period),
    accounts: sorted(input.filters.accounts),
    categories: sorted(input.filters.categories),
    status: input.filters.status || null,
    currency: input.filters.currency,
    amountMin: input.filters.amountMin ?? null,
    amountMax: input.filters.amountMax ?? null,
    dataVersion: input.dataVersion,
  });
}

export function getExactCache(key: string, now = Date.now()) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(key);
    metrics.misses += 1;
    return null;
  }
  entry.hits += 1;
  metrics.hits += 1;
  return {...entry.response, cache:{hit:true,ttlSeconds:Math.max(0,Math.ceil((entry.expiresAt-now)/1000)),kind:"exact" as const}};
}

export function setExactCache(key: string, response: AssistantResponse, now = Date.now()) {
  cache.set(key,{response,expiresAt:now+TTL_MS,hits:0,createdAt:now});
  metrics.writes += 1;
}

export function cacheMetrics(): AssistantCacheMetrics {
  return {...metrics,size:cache.size};
}

export function clearExactCache() {
  cache.clear();
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.writes = 0;
}
