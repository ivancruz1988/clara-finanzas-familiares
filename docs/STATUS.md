# Estado del proyecto

Última revisión: **8 de agosto de 2026**.

| Etapa | Estado | Evidencia |
|---|---|---|
| 1. Base del proyecto | Completada | Repositorio público, documentación y build exitoso |
| 2. Supabase | En progreso | Esquema, RLS, trigger de propietario y guía de configuración |
| 3. Acceso familiar | Pendiente | — |
| 4. Cuentas y categorías | Pendiente | — |
| 5. Movimientos | Pendiente | — |
| 6. Presupuesto | Pendiente | — |
| 7. Pagos programados | Pendiente | — |
| 8. Tablero | Pendiente | — |
| 9. Calidad | Pendiente | — |
| 10. Publicación | Pendiente | — |

## Bloqueo actual

Para cerrar la etapa 2 hace falta crear el proyecto remoto en Supabase y configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El código no necesita ni debe recibir la clave `service_role`.
