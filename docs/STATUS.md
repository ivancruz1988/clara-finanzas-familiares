# Estado del proyecto

Última revisión: **9 de agosto de 2026**.

| Etapa | Estado | Evidencia |
|---|---|---|
| 1. Base del proyecto | Completada | Repositorio público, documentación y build |
| 2. Supabase | Completada | Esquema, RLS y entorno local |
| 3. Acceso familiar | Completada | Registro, sesión y creación de hogar |
| 4. Cuentas y categorías | Completada | CRUD persistente con RLS |
| 5. Refactorización modular | Completada | UI, servicios Supabase y tipos separados por módulo |
| 6. Motor financiero | Próxima | Cálculos deterministas compartidos |
| 7-11. Núcleo financiero | Pendiente | Movimientos, transferencias, presupuesto, pagos y tablero |
| 12. Auditoría y versionado | Pendiente | Auditoría, idempotencia y `data_version` |
| 13-20. IA y RAG | Diseñada | Arquitectura documentada; implementación pendiente |
| 21. Evaluaciones de IA | Pendiente | Casos de precisión, seguridad y rendimiento |
| 22-24. Importación y publicación | Pendiente | Excel, calidad y Vercel |

## Próxima etapa

Implementar el motor financiero compartido para saldos, periodos y proyecciones antes de completar movimientos. La interfaz y el futuro asistente utilizarán las mismas reglas.

## Decisiones aprobadas

- SQL será la fuente de verdad financiera.
- Se implementará caché exacta antes de caché semántica.
- La búsqueda será híbrida: filtros + texto completo + pgvector.
- Toda salida de IA se validará antes de mostrarse.
- La seguridad y la caché estarán aisladas por hogar.
