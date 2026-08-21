# ADR 002: Caché semántica y búsqueda híbrida

## Estado

Aceptado para implementación gradual.

## Decisión

Usar caché exacta antes de caché semántica. La recuperación combinará filtros SQL, texto completo y `pgvector`. Sólo se reutilizarán respuestas del mismo hogar con filtros críticos equivalentes y versión vigente.

## Motivo

La caché reduce latencia y coste; la búsqueda híbrida mejora resultados cuando existen nombres exactos y conceptos equivalentes.

## Consecuencias

- se necesita `data_version` por hogar;
- embeddings y caché tienen RLS;
- los umbrales se ajustan mediante evaluaciones;
- cambios de modelo requieren versionado y posible reindexación;
- una coincidencia vectorial nunca autoriza por sí sola una respuesta.
