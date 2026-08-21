import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAssistantRateLimit } from "@/features/assistant/rate-limit";
import { classifyIntent, parseAssistantRequest, type AssistantError, type AssistantResponse } from "@/features/assistant/contracts";
import { buildAssistantFilters } from "@/features/assistant/filters";
import { buildExactCacheKey, cacheMetrics, getExactCache, setExactCache } from "@/features/assistant/cache";
import { SEMANTIC_ASSIST_THRESHOLD, SEMANTIC_REUSE_THRESHOLD } from "@/features/assistant/semantic-cache";
import { buildRagContext } from "@/features/assistant/rag";
import { applyOutputGuard } from "@/features/assistant/output-guard";
import { buildFinancialSummary, summaryAnswer } from "@/features/assistant/summary";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function jsonError(status: number, code: AssistantError["error"]["code"], message: string) {
  return NextResponse.json({error:{code,message}} satisfies AssistantError,{status});
}

function bearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function supabaseForRequest(token: string) {
  if (!url || !anonKey) return null;
  return createClient(url,anonKey,{
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession:false, autoRefreshToken:false },
  });
}

function naturalAnswer(input: { intent:string; periodLabel:string; summaryText?: string }) {
  if (input.intent === "unknown") {
    return "No pude ubicar exactamente que dato financiero queres ver. Probame con: cuanto dinero tengo, pagos pendientes, movimientos del mes o presupuesto.";
  }
  if (input.intent === "summary") {
    return input.summaryText || "No encontre cuentas cargadas todavia para calcular tu disponible.";
  }
  if (input.intent === "payments") {
    return `Te puedo ayudar con los pagos de ${input.periodLabel}. Si queres confirmar uno, primero te voy a pedir confirmacion.`;
  }
  if (input.intent === "budget") {
    return `Puedo revisar el presupuesto de ${input.periodLabel} y compararlo contra los movimientos cargados.`;
  }
  if (input.intent === "transactions") {
    return `Puedo buscar movimientos de ${input.periodLabel} por texto, categoria o similitud.`;
  }
  return "Ya entendi la consulta y la voy a resolver con datos verificados.";
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "assistant",
    contract: "v1",
    writesRequireConfirmation: true,
    cache: cacheMetrics(),
    semanticCache: {
      ready: true,
      reuseThreshold: SEMANTIC_REUSE_THRESHOLD,
      assistThreshold: SEMANTIC_ASSIST_THRESHOLD,
      requiresEmbedding: true,
    },
    hybridSearch: {
      ready: true,
      ranking: "rrf",
      engines: ["full-text","pgvector","structured-filters"],
    },
    rag: {
      ready: true,
      engines: ["sql","hybrid","vector","clarify"],
      sqlIsSourceOfTruth: true,
    },
    outputGuard: {
      ready: true,
      checks: ["sources","data_version","currency","sql_verification","privacy","confirmation"],
    },
  });
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) return jsonError(401,"unauthorized","Falta el token de sesion.");

  const supabase = supabaseForRequest(token);
  if (!supabase) return jsonError(503,"not_configured","Supabase no esta configurado.");

  const userResult = await supabase.auth.getUser(token);
  if (userResult.error || !userResult.data.user) return jsonError(401,"unauthorized","Sesion invalida o vencida.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400,"bad_request","El cuerpo debe ser JSON valido.");
  }

  let input;
  try {
    input = parseAssistantRequest(body);
  } catch (error) {
    return jsonError(400,"bad_request",error instanceof Error ? error.message : "Solicitud invalida.");
  }

  const householdResult = await supabase.rpc("current_household").maybeSingle();
  if (householdResult.error || !householdResult.data) {
    return jsonError(401,"unauthorized","No se encontro un hogar asociado a la sesion.");
  }

  const household = householdResult.data as { id:string; name:string; role:string };
  const limit = checkAssistantRateLimit(`${userResult.data.user.id}:${household.id}`);
  if (!limit.allowed) {
    return NextResponse.json({
      error:{code:"rate_limited",message:"Demasiadas consultas. Proba de nuevo en un minuto."},
    } satisfies AssistantError,{
      status:429,
      headers: {"Retry-After": String(Math.ceil((limit.resetAt-Date.now())/1000))},
    });
  }

  const versionResult = await supabase.from("households").select("data_version").eq("id",household.id).single();
  if (versionResult.error) return jsonError(500,"server_error","No se pudo leer la version de datos del hogar.");

  const dataVersion = Number((versionResult.data as {data_version:number | string}).data_version || 0);
  const intent = classifyIntent(input.message);
  const [accountsResult,categoriesResult] = await Promise.all([
    supabase.from("accounts").select("id,name").eq("household_id",household.id),
    supabase.from("categories").select("id,name").eq("household_id",household.id),
  ]);
  if (accountsResult.error || categoriesResult.error) return jsonError(500,"server_error","No se pudieron leer filtros del hogar.");
  const filters = buildAssistantFilters({
    message: input.message,
    intent,
    accounts: (accountsResult.data || []).map(item=>({id:item.id as string,name:item.name as string})),
    categories: (categoriesResult.data || []).map(item=>({id:item.id as string,name:item.name as string})),
  });
  const cacheKey = buildExactCacheKey({
    householdId: household.id,
    userId: userResult.data.user.id,
    message: input.message,
    intent,
    filters,
    dataVersion,
  });
  const cached = getExactCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached,{
      headers: {
        "X-RateLimit-Remaining": String(limit.remaining),
        "X-Data-Version": String(dataVersion),
        "X-Assistant-Cache": "hit",
      },
    });
  }
  const ragPlan = buildRagContext({
    householdId: household.id,
    dataVersion,
    intent,
    filters,
    message: input.message,
  });
  let summaryText: string | undefined;
  if (intent === "summary") {
    const [summaryAccounts,summaryMovements,summaryPending] = await Promise.all([
      supabase.from("accounts").select("id,name,opening_balance").eq("household_id",household.id),
      supabase.from("transactions").select("account_id,amount,kind").eq("household_id",household.id),
      supabase.from("payment_orders").select("amount").eq("household_id",household.id).eq("status","pending"),
    ]);
    if (summaryAccounts.error || summaryMovements.error || summaryPending.error) {
      return jsonError(500,"server_error","No se pudo calcular el disponible.");
    }
    const summary = buildFinancialSummary({
      accounts: (summaryAccounts.data || []).map(item=>({
        id: item.id as string,
        name: item.name as string,
        opening_balance: item.opening_balance as number | string,
      })),
      movements: (summaryMovements.data || []).map(item=>({
        account_id: item.account_id as string,
        amount: item.amount as number | string,
        kind: item.kind as "income" | "expense",
      })),
      pendingPayments: (summaryPending.data || []).map(item=>({
        amount: item.amount as number | string,
      })),
    });
    summaryText = summaryAnswer(summary);
  }
  const answer = naturalAnswer({intent,periodLabel:filters.period.label,summaryText});

  const response: AssistantResponse = {
    answer,
    intent,
    filters,
    householdId: household.id,
    dataVersion,
    currency: "ARS",
    sources: [
      {type:"household",label:household.name,dataVersion},
      {type:"contract",label:"assistant-api-v1"},
      {type:ragPlan.engine === "hybrid" ? "hybrid" : ragPlan.engine === "vector" ? "vector" : "sql",label:`rag-${ragPlan.engine}`,dataVersion},
    ],
    confidence: intent === "summary" && summaryText ? "medium" : "low",
    requiresConfirmation: false,
    rag: {
      engine: ragPlan.engine,
      hybridMode: ragPlan.hybridMode,
      needsEmbedding: ragPlan.needsEmbedding,
      needsSqlVerification: ragPlan.needsSqlVerification,
      contextCount: ragPlan.context.length,
    },
    cache: {hit:false,ttlSeconds:300,kind:"exact"},
  };
  const guardedResponse = applyOutputGuard(response);
  setExactCache(cacheKey,guardedResponse);

  return NextResponse.json(guardedResponse,{
    headers: {
      "X-RateLimit-Remaining": String(limit.remaining),
      "X-Data-Version": String(dataVersion),
      "X-Assistant-Cache": "miss",
      "X-Assistant-Output": guardedResponse.output?.status || "unknown",
    },
  });
}
