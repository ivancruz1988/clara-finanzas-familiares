# Diccionario de datos

## Datos financieros actuales

| Tabla | Propósito | Claves y controles |
|---|---|---|
| `households` | Hogar compartido | propietario, configuración y `data_version` |
| `household_members` | Usuarios y roles | PK hogar + usuario; `owner` o `member` |
| `accounts` | Efectivo, banco y billetera | hogar, tipo, saldo inicial y color |
| `categories` | Clasificación de ingresos/gastos | hogar, nombre y tipo |
| `transactions` | Movimientos reales | cuenta, categoría, fecha, importe, tipo y creador |
| `monthly_budgets` | Plan mensual | categoría, mes, importe e inflación |
| `payment_orders` | Compromisos futuros | vencimiento, importe, estado y cuenta |

## Ampliaciones financieras

### `households.data_version`

Contador creciente usado para invalidar caché y respuestas antiguas. Se incrementa en cada cambio financiero relevante.

### `transactions.idempotency_key`

Clave única por hogar que impide duplicar movimientos durante reintentos.

### `transactions.transfer_group_id`

Vincula la salida y entrada que forman una transferencia entre cuentas.

### Estados recomendados

- `pending`: pendiente;
- `confirmed`: confirmado;
- `cancelled`: cancelado;
- `reconciled`: conciliado.

## Auditoría

### `audit_events`

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | Identificador |
| `household_id` | uuid | Hogar afectado |
| `user_id` | uuid | Usuario responsable |
| `event_type` | text | Acción realizada |
| `entity_type` | text | Tipo de entidad |
| `entity_id` | uuid | Registro afectado |
| `metadata` | jsonb | Metadatos redactados |
| `created_at` | timestamptz | Fecha del evento |

No debe almacenar contraseñas, tokens, claves, números completos de tarjeta ni prompts financieros completos.

## Datos para RAG

### `ai_documents`

Representa una fuente lógica: documentación, comprobante o conjunto importado.

| Campo | Descripción |
|---|---|
| `id` | Identificador |
| `household_id` | Hogar propietario; nulo sólo para documentación pública controlada |
| `source_type` | `help`, `receipt`, `transaction`, `note` |
| `source_id` | Identificador del registro original |
| `title` | Nombre visible |
| `content_hash` | Detecta cambios y duplicados |
| `embedding_version` | Modelo y versión usados |
| `created_at`, `updated_at` | Trazabilidad |

### `ai_document_sections`

| Campo | Descripción |
|---|---|
| `document_id` | Documento padre |
| `household_id` | Filtro directo para seguridad y rendimiento |
| `content` | Fragmento recuperable |
| `embedding` | Vector generado |
| `fts` | Índice de texto completo |
| `metadata` | Periodo, categoría, cuenta, moneda y tipo |
| `token_count` | Control del tamaño de contexto |

### `ai_query_cache`

| Campo | Descripción |
|---|---|
| `household_id`, `user_id` | Ámbito de seguridad |
| `normalized_query` | Pregunta normalizada |
| `query_hash` | Clave de caché exacta |
| `intent` | Intención detectada |
| `filters` | Filtros estructurados |
| `answer_payload` | Salida ya validada |
| `source_ids` | Evidencia utilizada |
| `embedding` | Búsqueda de consultas similares |
| `data_version` | Versión financiera usada |
| `expires_at` | Vencimiento |

### `ai_query_runs`

Registro técnico de rendimiento y evaluación: motor, latencia, caché, confianza, fuentes, estado de validación y coste estimado. Los textos sensibles deben redactarse o resumirse.

## Relaciones de seguridad

Todas las tablas familiares y de IA deben incluir o poder resolver `household_id`. RLS valida la membresía; los RPC sensibles vuelven a verificar el usuario autenticado. Ningún identificador enviado desde el navegador se considera autorización suficiente.
