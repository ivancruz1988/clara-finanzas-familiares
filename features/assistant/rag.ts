import type { AssistantIntent } from "./contracts";
import type { AssistantFilters } from "./filters";

export type RagEngine = "sql" | "vector" | "hybrid" | "clarify";
export type HybridSearchMode = "balanced" | "text_first" | "semantic_first";

export type RagContextItem = {
  id: string;
  type: "sql_scope" | "vector_scope" | "hybrid_scope" | "guardrail";
  label: string;
  dataVersion: number;
  required: boolean;
};

export type RagPlan = {
  engine: RagEngine;
  hybridMode?: HybridSearchMode;
  reasons: string[];
  context: RagContextItem[];
  needsEmbedding: boolean;
  needsSqlVerification: boolean;
};

function hasConceptualLanguage(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return /(parecido|relacionado|por que|porque|tendencia|explica|similar|concepto|patron|habitual)/.test(normalized);
}

function hasDocumentLanguage(message: string) {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return /(ticket|factura|comprobante|recibo|nota|documento)/.test(normalized);
}

function inferRagHybridMode(message: string): HybridSearchMode {
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if (/(factura|ticket|comprobante|ypf|mercado|galicia|uala|personal|edenor|metrogas)/.test(normalized)) return "text_first";
  if (/(parecido|relacionado|por que|porque|tendencia|explica|similar|concepto)/.test(normalized)) return "semantic_first";
  return "balanced";
}

export function routeRagQuery(input: {
  message: string;
  intent: AssistantIntent;
  filters: AssistantFilters;
}): Pick<RagPlan,"engine"|"hybridMode"|"reasons"|"needsEmbedding"|"needsSqlVerification"> {
  if (input.intent === "unknown") {
    return {
      engine: "clarify",
      reasons: ["No se detecto una intencion financiera suficiente."],
      needsEmbedding: false,
      needsSqlVerification: false,
    };
  }

  const conceptual = hasConceptualLanguage(input.message);
  const documentLike = hasDocumentLanguage(input.message);
  if (conceptual || documentLike) {
    return {
      engine: "hybrid",
      hybridMode: inferRagHybridMode(input.message),
      reasons: [
        conceptual ? "La consulta pide significado o explicacion." : "La consulta menciona documentos o comprobantes.",
        "El resultado financiero debe recalcularse con SQL antes de mostrarse.",
      ],
      needsEmbedding: true,
      needsSqlVerification: true,
    };
  }

  if (input.intent === "transactions") {
    return {
      engine: "hybrid",
      hybridMode: inferRagHybridMode(input.message),
      reasons: ["Los movimientos pueden beneficiarse de texto completo y similitud semantica."],
      needsEmbedding: true,
      needsSqlVerification: true,
    };
  }

  return {
    engine: "sql",
    reasons: ["La consulta requiere cifras deterministicas de la base financiera."],
    needsEmbedding: false,
    needsSqlVerification: true,
  };
}

export function buildRagContext(input: {
  householdId: string;
  dataVersion: number;
  intent: AssistantIntent;
  filters: AssistantFilters;
  message: string;
}): RagPlan {
  const route = routeRagQuery({message:input.message,intent:input.intent,filters:input.filters});
  const context: RagContextItem[] = [
    {
      id: `${input.householdId}:data-version:${input.dataVersion}`,
      type: "guardrail",
      label: "Version vigente del hogar",
      dataVersion: input.dataVersion,
      required: true,
    },
    {
      id: `${input.householdId}:period:${input.filters.period.from}:${input.filters.period.to}`,
      type: "sql_scope",
      label: `Periodo ${input.filters.period.label}`,
      dataVersion: input.dataVersion,
      required: route.needsSqlVerification,
    },
  ];

  if (route.engine === "hybrid" || route.engine === "vector") {
    context.push({
      id: `${input.householdId}:rag:${input.intent}`,
      type: route.engine === "hybrid" ? "hybrid_scope" : "vector_scope",
      label: "Contexto documental autorizado por RLS",
      dataVersion: input.dataVersion,
      required: true,
    });
  }

  return {...route,context};
}
