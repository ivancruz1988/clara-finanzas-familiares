import type { AssistantIntent } from "@/features/assistant/contracts";

export type AssistantPeriod = {
  label: string;
  from: string;
  to: string;
};

export type AssistantFilters = {
  period: AssistantPeriod;
  accounts: string[];
  categories: string[];
  status?: "pending" | "paid";
  currency: "ARS";
  amountMin?: number;
  amountMax?: number;
};

export type FilterOption = {
  id: string;
  name: string;
};

const DAY_MS = 24*60*60*1000;

function dateOnly(date: Date) {
  return date.toISOString().slice(0,10);
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));
}

function nextMonthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

export function resolvePeriod(message: string, now = new Date()): AssistantPeriod {
  const text = normalize(message);
  const today = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if (/\bhoy\b/.test(text)) {
    const tomorrow = new Date(today.getTime()+DAY_MS);
    return {label:"hoy",from:dateOnly(today),to:dateOnly(tomorrow)};
  }
  if (/\bayer\b/.test(text)) {
    const yesterday = new Date(today.getTime()-DAY_MS);
    return {label:"ayer",from:dateOnly(yesterday),to:dateOnly(today)};
  }
  if (/(mes anterior|mes pasado)/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1));
    const end = monthStart(today);
    return {label:"mes anterior",from:dateOnly(start),to:dateOnly(end)};
  }
  if (/(este mes|mes actual|del mes|presupuesto)/.test(text)) {
    const start = monthStart(today);
    const end = nextMonthStart(today);
    return {label:"mes actual",from:dateOnly(start),to:dateOnly(end)};
  }
  if (/(este ano|este año|anual)/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(),0,1));
    const end = new Date(Date.UTC(today.getUTCFullYear()+1,0,1));
    return {label:"ano actual",from:dateOnly(start),to:dateOnly(end)};
  }
  const start = monthStart(today);
  return {label:"mes actual",from:dateOnly(start),to:dateOnly(nextMonthStart(today))};
}

export function extractStatus(message: string) {
  const text = normalize(message);
  if (/(pendiente|vencido|a pagar)/.test(text)) return "pending" as const;
  if (/(pagado|confirmado|abonado)/.test(text)) return "paid" as const;
  return undefined;
}

export function extractAmounts(message: string) {
  const normalized = normalize(message).replace(/\./g,"").replace(/,/g,".");
  const numbers = [...normalized.matchAll(/(?:\$|ars)?\s*(\d+(?:\.\d+)?)/g)].map(match=>Number(match[1])).filter(Number.isFinite);
  if (numbers.length === 0) return {};
  if (/(mayor|mas de|superior|arriba de)/.test(normalized)) return {amountMin:numbers[0]};
  if (/(menor|menos de|inferior|debajo de)/.test(normalized)) return {amountMax:numbers[0]};
  return {};
}

export function matchOptions(message: string, options: FilterOption[]) {
  const text = normalize(message);
  return options.filter(option=>text.includes(normalize(option.name))).map(option=>option.id);
}

export function buildAssistantFilters(input: {
  message: string;
  intent: AssistantIntent;
  accounts: FilterOption[];
  categories: FilterOption[];
  now?: Date;
}): AssistantFilters {
  const amounts = extractAmounts(input.message);
  return {
    period: resolvePeriod(input.message,input.now),
    accounts: matchOptions(input.message,input.accounts),
    categories: matchOptions(input.message,input.categories),
    status: input.intent === "payments" ? extractStatus(input.message) : undefined,
    currency: "ARS",
    ...amounts,
  };
}
