import type { AssistantResponse } from "./contracts";

export type OutputValidationStatus = "approved" | "needs_review" | "blocked";

export type OutputValidation = {
  status: OutputValidationStatus;
  reasons: string[];
  redactions: number;
};

const SECRET_PATTERNS = [
  /sk-[a-z0-9_-]{12,}/gi,
  /sb_(?:publishable|secret)_[a-z0-9_-]{12,}/gi,
  /\b(?:\d[ -]?){13,19}\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
];

export function redactSensitiveText(value: string) {
  let redactions = 0;
  let text = value;
  for (const pattern of SECRET_PATTERNS) {
    text = text.replace(pattern,()=>{
      redactions += 1;
      return "[redactado]";
    });
  }
  return {text,redactions};
}

export function validateAssistantOutput(response: AssistantResponse): OutputValidation {
  const reasons: string[] = [];
  if (!response.sources.length) reasons.push("La respuesta no incluye fuentes.");
  if (response.sources.some(source=>source.dataVersion !== undefined && source.dataVersion !== response.dataVersion)) {
    reasons.push("Hay fuentes con una version de datos distinta.");
  }
  if (response.currency !== "ARS") reasons.push("La moneda no coincide con el contrato ARS.");
  if (response.rag?.needsSqlVerification && response.confidence === "high") {
    reasons.push("Una respuesta pendiente de verificacion SQL no puede marcarse con confianza alta.");
  }
  if (response.rag?.engine === "clarify" && response.confidence !== "low") {
    reasons.push("Una aclaracion debe salir con confianza baja.");
  }
  const redacted = redactSensitiveText(response.answer);
  if (redacted.redactions > 0) reasons.push("La respuesta contenia datos sensibles redactados.");
  if (response.requiresConfirmation && !/confirm/i.test(response.answer)) {
    reasons.push("Una accion que requiere confirmacion debe indicarlo explicitamente.");
  }

  if (reasons.some(reason=>/datos sensibles|version|moneda/i.test(reason))) {
    return {status:"blocked",reasons,redactions:redacted.redactions};
  }
  if (reasons.length > 0 || response.confidence === "low") {
    return {status:"needs_review",reasons,redactions:redacted.redactions};
  }
  return {status:"approved",reasons,redactions:redacted.redactions};
}

export function applyOutputGuard(response: AssistantResponse): AssistantResponse {
  const redacted = redactSensitiveText(response.answer);
  const guarded = {
    ...response,
    answer: redacted.text,
  };
  const validation = validateAssistantOutput(guarded);
  const output = {
    ...validation,
    status: redacted.redactions > 0 ? "blocked" as const : validation.status,
    reasons: redacted.redactions > 0 && !validation.reasons.some(reason=>/datos sensibles/i.test(reason))
      ? [...validation.reasons,"La respuesta contenia datos sensibles redactados."]
      : validation.reasons,
    redactions: Math.max(validation.redactions,redacted.redactions),
  };
  return {
    ...guarded,
    output,
    confidence: output.status === "approved" ? guarded.confidence : "low",
  };
}
