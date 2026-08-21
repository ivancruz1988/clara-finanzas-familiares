# ADR 001: SQL como fuente de verdad financiera

## Estado

Aceptado.

## Decisión

PostgreSQL calculará saldos, totales, presupuestos, estados y periodos. La IA sólo interpretará la intención, recuperará contexto y redactará explicaciones.

## Motivo

La búsqueda vectorial es aproximada y un modelo puede cometer errores aritméticos. Las finanzas requieren resultados deterministas, auditables y reproducibles.

## Consecuencias

- toda cifra de IA se recalcula;
- los cálculos viven en una capa compartida;
- RAG no sustituye consultas SQL;
- las respuestas incluyen fuentes y periodo.
