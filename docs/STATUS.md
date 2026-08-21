# Estado del proyecto

Ultima revision: **12 de agosto de 2026**.

| Etapa | Estado | Evidencia |
|---|---|---|
| 1. Base del proyecto | Completada | Repositorio publico, documentacion y build |
| 2. Supabase | Completada | Esquema, RLS y entorno local |
| 3. Acceso familiar | Completada | Registro, sesion y creacion de hogar |
| 4. Cuentas y categorias | Completada | CRUD persistente con RLS |
| 5. Refactorizacion modular | Completada | UI, servicios Supabase y tipos separados por modulo |
| 6. Motor financiero | Completada | Saldos, disponible, pendientes y proyeccion con pruebas unitarias |
| 7. Movimientos | Completada | CRUD, busqueda y filtro por tipo sobre datos reales de Supabase |
| 8. Transferencias | Completada | Operacion atomica entre cuentas con doble movimiento y trazabilidad |
| 9. Presupuesto | Completada | Plan mensual persistido, copia del mes anterior y comparacion contra movimientos reales |
| 10. Pagos programados | Completada | Vencimientos persistidos, cuenta de origen, confirmacion y movimiento de gasto asociado |
| 11. Tablero real | Completada | Disponible, pagos pendientes, proyeccion, presupuesto y ultimos movimientos desde Supabase |
| 12. Auditoria y versionado | Completada | `audit_events`, `data_version` e idempotencia en movimientos y pagos |
| 13. API del asistente | Completada | `app/api/assistant`, autenticacion Supabase, rate limit y contrato JSON v1 |
| 14. Intenciones y filtros | Completada | Clasificador, periodos relativos, cuentas, categorias, moneda, estado y montos |
| 15. Cache exacta | Completada | Clave normalizada por hogar, usuario, filtros y `data_version`, TTL y metricas |
| 16. Base vectorial | Completada | `pgvector`, `ai_documents`, `ai_document_sections`, embeddings, FTS y RLS |
| 17. Cache semantica | Completada | Tabla `ai_query_cache`, RPC de similitud, umbrales, filtros criticos y tests |
| 18. Busqueda hibrida | Completada | `hybrid_search_ai_document_sections`, ranking RRF, pesos por modo y tests |
| 19. RAG financiero | Completada | Enrutador SQL/hibrido, contexto verificable, guardrails por `data_version` y tests |
| 20. Filtros de salida | Completada | `output-guard`, redaccion sensible, validacion de fuentes/version/moneda/confianza y tests |
| 21. Evaluaciones de IA | Completada | `tests/ai-evals`, casos de precision, RAG, seguridad, privacidad y regresion |
| 22-23. Calidad y publicacion | Pendiente | Build final, variables, migraciones, respaldo y Vercel |

## Proxima etapa

Publicar la app con las funciones actuales y dejar mejoras futuras fuera del bloqueo de lanzamiento.

## Decisiones aprobadas

- SQL sera la fuente de verdad financiera.
- Confirmar un pago programado genera un movimiento financiero real de gasto.
- Cada cambio financiero incrementa `households.data_version` y registra un evento auditable.
- Se implementara cache exacta antes de cache semantica.
- La busqueda sera hibrida: filtros + texto completo + pgvector.
- Toda salida de IA se validara antes de mostrarse.
- La seguridad y la cache estaran aisladas por hogar.

