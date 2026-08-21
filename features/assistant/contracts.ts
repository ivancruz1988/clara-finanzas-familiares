export type AssistantIntent = "summary" | "transactions" | "budget" | "payments" | "unknown";

export type AssistantRequest = {
  message: string;
  timezone?: string;
  locale?: string;
};

export type AssistantSource = {
  type: "household" | "contract" | "sql" | "vector" | "hybrid";
  label: string;
  dataVersion?: number;
};

export type AssistantResponse = {
  answer: string;
  intent: AssistantIntent;
  filters?: {
    period: { label:string; from:string; to:string };
    accounts: string[];
    categories: string[];
    status?: "pending" | "paid";
    currency: "ARS";
    amountMin?: number;
    amountMax?: number;
  };
  householdId: string;
  dataVersion: number;
  currency: "ARS";
  sources: AssistantSource[];
  confidence: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  output?: {
    status: "approved" | "needs_review" | "blocked";
    reasons: string[];
    redactions: number;
  };
  rag?: {
    engine: "sql" | "vector" | "hybrid" | "clarify";
    hybridMode?: "balanced" | "text_first" | "semantic_first";
    needsEmbedding: boolean;
    needsSqlVerification: boolean;
    contextCount: number;
  };
  cache?: {
    hit: boolean;
    ttlSeconds: number;
    kind?: "exact" | "semantic";
    similarity?: number;
  };
};

export type AssistantError = {
  error: {
    code: "bad_request" | "unauthorized" | "rate_limited" | "server_error" | "not_configured";
    message: string;
  };
};

export function parseAssistantRequest(value: unknown): AssistantRequest {
  if (!value || typeof value !== "object") throw new Error("El cuerpo debe ser un objeto JSON.");
  const input = value as Record<string, unknown>;
  if (typeof input.message !== "string" || input.message.trim().length < 2) {
    throw new Error("El mensaje debe tener al menos 2 caracteres.");
  }
  if (input.message.length > 1000) throw new Error("El mensaje no puede superar 1000 caracteres.");
  return {
    message: input.message.trim(),
    timezone: typeof input.timezone === "string" ? input.timezone : undefined,
    locale: typeof input.locale === "string" ? input.locale : undefined,
  };
}

export function classifyIntent(message: string): AssistantIntent {
  const normalizedClean = message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if (/(resumen|saldo|disponible|proyeccion|estado|plata|dinero|cuanto tengo|cuanta plata|fondos|total disponible)/.test(normalizedClean)) return "summary";
  if (/(presupuesto|categoria|plan)/.test(normalizedClean)) return "budget";
  const normalized = message.toLowerCase();
  if (/(resumen|saldo|disponible|proyeccion|proyección|estado)/.test(normalized)) return "summary";
  if (/(movimiento|gasto|ingreso|transacci)/.test(normalized)) return "transactions";
  if (/(presupuesto|categoria|categoría|plan)/.test(normalized)) return "budget";
  if (/(pago|vencimiento|pendiente|cuota)/.test(normalized)) return "payments";
  return "unknown";
}
