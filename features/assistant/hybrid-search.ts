export const DEFAULT_RRF_K = 60;
export const DEFAULT_TEXT_WEIGHT = 0.5;
export const DEFAULT_VECTOR_WEIGHT = 0.5;

export type HybridSearchMode = "balanced" | "text_first" | "semantic_first";

export type RankedHit = {
  id: string;
  rank: number;
  score?: number;
};

export type HybridRankedHit = {
  id: string;
  textRank?: number;
  vectorRank?: number;
  textScore: number;
  vectorScore: number;
  hybridScore: number;
};

export function weightsForHybridMode(mode: HybridSearchMode) {
  if (mode === "text_first") return {textWeight:0.65,vectorWeight:0.35};
  if (mode === "semantic_first") return {textWeight:0.35,vectorWeight:0.65};
  return {textWeight:DEFAULT_TEXT_WEIGHT,vectorWeight:DEFAULT_VECTOR_WEIGHT};
}

function rrf(rank: number | undefined, k = DEFAULT_RRF_K) {
  if (!rank || rank < 1) return 0;
  return 1/(k+rank);
}

export function reciprocalRankFusion(input: {
  textHits: RankedHit[];
  vectorHits: RankedHit[];
  mode?: HybridSearchMode;
  rrfK?: number;
  limit?: number;
}): HybridRankedHit[] {
  const weights = weightsForHybridMode(input.mode || "balanced");
  const records = new Map<string,HybridRankedHit>();

  for (const hit of input.textHits) {
    records.set(hit.id,{
      id: hit.id,
      textRank: hit.rank,
      textScore: rrf(hit.rank,input.rrfK)*weights.textWeight,
      vectorScore: 0,
      hybridScore: 0,
    });
  }

  for (const hit of input.vectorHits) {
    const existing = records.get(hit.id);
    if (existing) {
      existing.vectorRank = hit.rank;
      existing.vectorScore = rrf(hit.rank,input.rrfK)*weights.vectorWeight;
    } else {
      records.set(hit.id,{
        id: hit.id,
        vectorRank: hit.rank,
        textScore: 0,
        vectorScore: rrf(hit.rank,input.rrfK)*weights.vectorWeight,
        hybridScore: 0,
      });
    }
  }

  return [...records.values()]
    .map(hit=>({...hit,hybridScore:hit.textScore+hit.vectorScore}))
    .sort((a,b)=>b.hybridScore-a.hybridScore || a.id.localeCompare(b.id))
    .slice(0,input.limit ?? 8);
}

export function inferHybridMode(query: string): HybridSearchMode {
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if (/(factura|ticket|comprobante|ypf|mercado|galicia|uala|personal|edenor|metrogas)/.test(normalized)) {
    return "text_first";
  }
  if (/(parecido|relacionado|por que|porque|tendencia|explica|similar|concepto)/.test(normalized)) {
    return "semantic_first";
  }
  return "balanced";
}
