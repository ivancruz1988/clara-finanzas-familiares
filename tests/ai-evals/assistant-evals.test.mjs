import test from "node:test";
import assert from "node:assert/strict";
import { assistantEvalCases } from "./cases.mjs";
import { classifyIntent } from "../../features/assistant/contracts.ts";
import { buildAssistantFilters } from "../../features/assistant/filters.ts";
import { buildRagContext } from "../../features/assistant/rag.ts";
import { applyOutputGuard } from "../../features/assistant/output-guard.ts";

const NOW = new Date("2026-08-12T12:00:00Z");
const accounts = [{id:"acc-galicia",name:"Banco Galicia"}];
const categories = [{id:"cat-auto",name:"Auto"}];

function simulateAssistantPipeline(message) {
  const intent = classifyIntent(message);
  const filters = buildAssistantFilters({message,intent,accounts,categories,now:NOW});
  const ragPlan = buildRagContext({
    householdId:"household-eval",
    dataVersion:42,
    intent,
    filters,
    message,
  });
  const answer = message;
  const response = applyOutputGuard({
    answer,
    intent,
    filters,
    householdId:"household-eval",
    dataVersion:42,
    currency:"ARS",
    sources:[
      {type:"household",label:"Eval",dataVersion:42},
      {type:ragPlan.engine === "hybrid" ? "hybrid" : ragPlan.engine === "vector" ? "vector" : "sql",label:`rag-${ragPlan.engine}`,dataVersion:42},
    ],
    confidence: "low",
    requiresConfirmation: false,
    rag: {
      engine: ragPlan.engine,
      hybridMode: ragPlan.hybridMode,
      needsEmbedding: ragPlan.needsEmbedding,
      needsSqlVerification: ragPlan.needsSqlVerification,
      contextCount: ragPlan.context.length,
    },
  });
  return {intent,filters,ragPlan,response};
}

for (const item of assistantEvalCases) {
  test(`eval ia: ${item.id}`,()=>{
    const result = simulateAssistantPipeline(item.message);
    assert.equal(result.intent,item.expectedIntent);
    assert.equal(result.ragPlan.engine,item.expectedEngine);
    if (item.expectedHybridMode) assert.equal(result.ragPlan.hybridMode,item.expectedHybridMode);
    if (item.expectedStatus) assert.equal(result.filters.status,item.expectedStatus);
    if (item.expectedOutput) assert.equal(result.response.output?.status,item.expectedOutput);
    if (item.expectedRequiresConfirmation !== undefined) {
      assert.equal(result.response.requiresConfirmation,item.expectedRequiresConfirmation);
    }
    if (item.expectedRedactionsAtLeast !== undefined) {
      assert.ok((result.response.output?.redactions || 0) >= item.expectedRedactionsAtLeast);
    }
  });
}
