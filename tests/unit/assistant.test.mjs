import test from "node:test";
import assert from "node:assert/strict";
import { classifyIntent, parseAssistantRequest } from "../../features/assistant/contracts.ts";
import { buildExactCacheKey, cacheMetrics, clearExactCache, getExactCache, setExactCache } from "../../features/assistant/cache.ts";
import { buildAssistantFilters, resolvePeriod } from "../../features/assistant/filters.ts";
import { checkAssistantRateLimit } from "../../features/assistant/rate-limit.ts";
import { chunkDocument, contentHash, validateEmbedding } from "../../features/assistant/vector.ts";
import { buildSemanticCacheRecord, criticalFiltersEqual, semanticCacheDecision, semanticQueryHash } from "../../features/assistant/semantic-cache.ts";
import { inferHybridMode, reciprocalRankFusion, weightsForHybridMode } from "../../features/assistant/hybrid-search.ts";
import { buildRagContext, routeRagQuery } from "../../features/assistant/rag.ts";
import { applyOutputGuard, redactSensitiveText, validateAssistantOutput } from "../../features/assistant/output-guard.ts";
import { buildFinancialSummary, summaryAnswer } from "../../features/assistant/summary.ts";

test("valida y normaliza la solicitud del asistente",()=>{
  assert.deepEqual(parseAssistantRequest({message:"  resumen del mes  ",locale:"es-AR"}),{
    message:"resumen del mes",
    locale:"es-AR",
    timezone:undefined,
  });
  assert.throws(()=>parseAssistantRequest({message:"a"}),/al menos 2 caracteres/);
});

test("clasifica intenciones financieras basicas",()=>{
  assert.equal(classifyIntent("como viene el presupuesto"),"budget");
  assert.equal(classifyIntent("pagos pendientes"),"payments");
  assert.equal(classifyIntent("ultimos movimientos"),"transactions");
  assert.equal(classifyIntent("cuanto plata tengo"),"summary");
  assert.equal(classifyIntent("cual es mi saldo"),"summary");
  assert.equal(classifyIntent("hola"),"unknown");
});

test("limita consultas por ventana",()=>{
  const key=`user:household:${Math.random()}`;
  for(let i=0;i<20;i++) assert.equal(checkAssistantRateLimit(key,1000).allowed,true);
  assert.equal(checkAssistantRateLimit(key,1000).allowed,false);
  assert.equal(checkAssistantRateLimit(key,62_000).allowed,true);
});

test("resuelve periodos relativos",()=>{
  const now=new Date("2026-08-11T12:00:00Z");
  assert.deepEqual(resolvePeriod("pagos de hoy",now),{label:"hoy",from:"2026-08-11",to:"2026-08-12"});
  assert.deepEqual(resolvePeriod("mes anterior",now),{label:"mes anterior",from:"2026-07-01",to:"2026-08-01"});
});

test("extrae filtros de cuentas categorias estado y montos",()=>{
  const filters=buildAssistantFilters({
    message:"pagos pendientes de Banco Galicia en supermercado mayores de $10000 este mes",
    intent:"payments",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[{id:"acc-1",name:"Banco Galicia"}],
    categories:[{id:"cat-1",name:"Supermercado"}],
  });
  assert.equal(filters.status,"pending");
  assert.equal(filters.amountMin,10000);
  assert.deepEqual(filters.accounts,["acc-1"]);
  assert.deepEqual(filters.categories,["cat-1"]);
  assert.equal(filters.period.label,"mes actual");
});

test("cache exacta usa consulta normalizada y data_version",()=>{
  clearExactCache();
  const filters=buildAssistantFilters({
    message:"Pagos pendientes este mes",
    intent:"payments",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[],
    categories:[],
  });
  const key=buildExactCacheKey({householdId:"h1",userId:"u1",message:"  PAGOS   pendientes este mes ",intent:"payments",filters,dataVersion:1});
  const same=buildExactCacheKey({householdId:"h1",userId:"u1",message:"pagos pendientes este mes",intent:"payments",filters,dataVersion:1});
  const changed=buildExactCacheKey({householdId:"h1",userId:"u1",message:"pagos pendientes este mes",intent:"payments",filters,dataVersion:2});
  assert.equal(key,same);
  assert.notEqual(key,changed);
  setExactCache(key,{answer:"ok",intent:"payments",filters,householdId:"h1",dataVersion:1,currency:"ARS",sources:[],confidence:"low",requiresConfirmation:false},1000);
  assert.equal(getExactCache(same,1000)?.cache?.hit,true);
  assert.equal(getExactCache(same,400_000),null);
  assert.equal(cacheMetrics().writes,1);
});

test("prepara documentos vectoriales en secciones estables",()=>{
  const content="Ticket supermercado\n\nCompra de alimentos y limpieza para la semana.";
  const chunks=chunkDocument(content,4);
  assert.equal(chunks.length,2);
  assert.equal(chunks[0].sectionIndex,0);
  assert.equal(chunks[0].contentHash,contentHash("Ticket supermercado"));
  assert.throws(()=>validateEmbedding([1,2,3]),/1536 dimensiones/);
  validateEmbedding(Array.from({length:1536},()=>0.01));
});

test("cache semantica exige filtros y version antes de reutilizar",()=>{
  const filters=buildAssistantFilters({
    message:"pagos pendientes este mes",
    intent:"payments",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[{id:"acc-1",name:"Banco Galicia"}],
    categories:[],
  });
  const same=buildAssistantFilters({
    message:"que pagos tengo pendientes este mes",
    intent:"payments",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[{id:"acc-1",name:"Banco Galicia"}],
    categories:[],
  });
  const otherPeriod=buildAssistantFilters({
    message:"pagos pendientes mes anterior",
    intent:"payments",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[{id:"acc-1",name:"Banco Galicia"}],
    categories:[],
  });
  assert.equal(criticalFiltersEqual(filters,same),true);
  assert.equal(criticalFiltersEqual(filters,otherPeriod),false);
  assert.equal(semanticCacheDecision({similarity:0.95,filtersEqual:true,dataVersionEqual:true}),"reuse");
  assert.equal(semanticCacheDecision({similarity:0.88,filtersEqual:true,dataVersionEqual:true}),"assist");
  assert.equal(semanticCacheDecision({similarity:0.99,filtersEqual:false,dataVersionEqual:true}),"miss");
  assert.equal(semanticCacheDecision({similarity:0.99,filtersEqual:true,dataVersionEqual:false}),"miss");
});

test("cache semantica genera hash estable y vencimiento",()=>{
  const filters=buildAssistantFilters({
    message:"resumen este mes",
    intent:"summary",
    now:new Date("2026-08-11T12:00:00Z"),
    accounts:[],
    categories:[],
  });
  const hash=semanticQueryHash({householdId:"h1",userId:"u1",normalizedQuery:"resumen este mes",intent:"summary",filters,dataVersion:7});
  const record=buildSemanticCacheRecord({
    householdId:"h1",
    userId:"u1",
    message:"  Resumen   este mes ",
    intent:"summary",
    filters,
    dataVersion:7,
    embedding:Array.from({length:1536},()=>0.01),
    answerPayload:{answer:"ok",intent:"summary",filters,householdId:"h1",dataVersion:7,currency:"ARS",sources:[],confidence:"low",requiresConfirmation:false},
    now:new Date("2026-08-11T12:00:00Z"),
    ttlSeconds:60,
  });
  assert.equal(record.queryHash,hash);
  assert.equal(record.expiresAt,"2026-08-11T12:01:00.000Z");
});

test("busqueda hibrida fusiona texto y vectores con RRF",()=>{
  const hits=reciprocalRankFusion({
    textHits:[{id:"a",rank:1},{id:"b",rank:2}],
    vectorHits:[{id:"b",rank:1},{id:"c",rank:2}],
    limit:3,
  });
  assert.equal(hits[0].id,"b");
  assert.equal(hits[0].textRank,2);
  assert.equal(hits[0].vectorRank,1);
  assert.ok(hits[0].hybridScore > hits[1].hybridScore);
});

test("busqueda hibrida ajusta pesos segun tipo de consulta",()=>{
  assert.deepEqual(weightsForHybridMode("text_first"),{textWeight:0.65,vectorWeight:0.35});
  assert.deepEqual(weightsForHybridMode("semantic_first"),{textWeight:0.35,vectorWeight:0.65});
  assert.equal(inferHybridMode("ticket ypf agosto"),"text_first");
  assert.equal(inferHybridMode("por que subio lo relacionado al auto"),"semantic_first");
  assert.equal(inferHybridMode("gastos de este mes"),"balanced");
});

test("rag enruta calculos financieros deterministas a SQL",()=>{
  const filters=buildAssistantFilters({
    message:"como viene el presupuesto este mes",
    intent:"budget",
    now:new Date("2026-08-12T12:00:00Z"),
    accounts:[],
    categories:[],
  });
  const route=routeRagQuery({message:"como viene el presupuesto este mes",intent:"budget",filters});
  assert.equal(route.engine,"sql");
  assert.equal(route.needsSqlVerification,true);
  assert.equal(route.needsEmbedding,false);
});

test("rag arma contexto hibrido con guardrails y version",()=>{
  const filters=buildAssistantFilters({
    message:"explica gastos relacionados al auto este mes",
    intent:"transactions",
    now:new Date("2026-08-12T12:00:00Z"),
    accounts:[],
    categories:[],
  });
  const plan=buildRagContext({
    householdId:"h1",
    dataVersion:9,
    intent:"transactions",
    filters,
    message:"explica gastos relacionados al auto este mes",
  });
  assert.equal(plan.engine,"hybrid");
  assert.equal(plan.hybridMode,"semantic_first");
  assert.equal(plan.needsEmbedding,true);
  assert.equal(plan.needsSqlVerification,true);
  assert.equal(plan.context.some(item=>item.type==="guardrail" && item.dataVersion===9),true);
  assert.equal(plan.context.some(item=>item.type==="hybrid_scope"),true);
});

test("filtro de salida bloquea fuentes vencidas y datos sensibles",()=>{
  const response={
    answer:"Mi email es ivan@example.com y la tarjeta 4111 1111 1111 1111.",
    intent:"summary",
    householdId:"h1",
    dataVersion:3,
    currency:"ARS",
    sources:[{type:"sql",label:"consulta",dataVersion:2}],
    confidence:"medium",
    requiresConfirmation:false,
  };
  const guarded=applyOutputGuard(response);
  assert.equal(guarded.output?.status,"blocked");
  assert.equal(guarded.output?.redactions,2);
  assert.equal(guarded.answer.includes("[redactado]"),true);
});

test("filtro de salida aprueba solo respuestas trazables y coherentes",()=>{
  const response={
    answer:"Durante agosto el total verificado es ARS 100.",
    intent:"summary",
    householdId:"h1",
    dataVersion:3,
    currency:"ARS",
    sources:[{type:"sql",label:"consulta",dataVersion:3}],
    confidence:"high",
    requiresConfirmation:false,
    rag:{engine:"sql",needsEmbedding:false,needsSqlVerification:false,contextCount:2},
  };
  assert.equal(validateAssistantOutput(response).status,"approved");
  assert.deepEqual(redactSensitiveText("sin secretos"),{text:"sin secretos",redactions:0});
});

test("asistente calcula resumen financiero desde cuentas movimientos y pendientes",()=>{
  const summary=buildFinancialSummary({
    accounts:[
      {id:"cash",opening_balance:1000},
      {id:"bank",opening_balance:2000},
    ],
    movements:[
      {account_id:"cash",amount:500,kind:"income"},
      {account_id:"bank",amount:250,kind:"expense"},
    ],
    pendingPayments:[
      {amount:100},
      {amount:50},
    ],
  });
  assert.deepEqual(summary,{available:3250,pending:150,projected:3100,accountCount:2,pendingCount:2});
  assert.equal(summaryAnswer(summary).includes("$\u00a03.250"),true);
});
