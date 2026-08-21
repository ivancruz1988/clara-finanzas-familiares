# Plan diario de implementacion

Este plan refleja el avance real al 10 de agosto de 2026. Las etapas 1 a 10 ya quedaron abordadas antes de las fechas originales, por lo que el resto del calendario se reagenda desde el 11 de agosto.

## Etapas completadas

| Dia | Fecha | Etapa | Resultado |
|---|---|---|---|
| 1 | 03/08/2026 | Base del proyecto | Repositorio, documentacion y aplicacion Next.js |
| 2 | 04/08/2026 | Supabase | Esquema PostgreSQL, RLS y entorno local |
| 3 | 05/08/2026 | Acceso familiar | Registro, login, sesion y creacion de hogar |
| 4 | 09/08/2026 | Cuentas y categorias | CRUD persistente por hogar |
| 5 | 09/08/2026 | Refactorizacion modular | UI, servicios, tipos y modulos financieros separados |
| 6 | 09/08/2026 | Motor financiero | Saldos, pendientes y proyeccion con pruebas unitarias |
| 7 | 09/08/2026 | Movimientos | CRUD, busqueda y filtro por tipo con datos reales |
| 8 | 09/08/2026 | Transferencias | Operacion atomica entre cuentas con doble movimiento |
| 9 | 10/08/2026 | Presupuesto | Plan mensual persistido y comparacion contra gastos reales |
| 10 | 10/08/2026 | Pagos programados | Vencimientos persistidos, confirmacion y movimiento real asociado |
| 11 | 11/08/2026 | Tablero real | Indicadores obtenidos desde SQL y datos persistidos |
| 12 | 11/08/2026 | Auditoria y versionado | `audit_events`, `data_version` e idempotencia |
| 13 | 11/08/2026 | API del asistente | Endpoint servidor, autenticacion, rate limit y contratos JSON |
| 14 | 11/08/2026 | Intenciones y filtros | Clasificador, periodos, cuentas, categorias, moneda, estado y montos |
| 15 | 11/08/2026 | Cache exacta | Clave normalizada, TTL, metricas e invalidacion por `data_version` |
| 16 | 11/08/2026 | Base vectorial | `pgvector`, documentos, secciones, embeddings, FTS y RLS |
| 17 | 11/08/2026 | Cache semantica | Similitud, umbrales, aislamiento por hogar y reutilizacion segura |
| 18 | 12/08/2026 | Busqueda hibrida | Full-text + vectores + filtros estructurados + ranking RRF |
| 19 | 12/08/2026 | RAG financiero | Enrutador SQL/vector/hibrido y construccion de contexto |
| 20 | 12/08/2026 | Filtros de salida | Validacion de fuentes, cifras, vigencia, privacidad y confianza |
| 21 | 12/08/2026 | Evaluaciones de IA | Casos esperados, seguridad, precision, latencia y coste |

## Agenda de publicación

| Dia | Fecha | Etapa | Entregable verificable |
|---|---|---|---|
| 22 | 20/08/2026 | Calidad integral | Pruebas, responsive, accesibilidad, rendimiento y seguridad |
| 23 | 20/08/2026 | Publicacion | Vercel, variables, migraciones, respaldo y manual de uso |

## Orden de dependencias

```mermaid
flowchart LR
    A["Modulos financieros"] --> B["Motor financiero"]
    B --> C["Auditoria y data_version"]
    C --> D["API del asistente"]
    D --> E["Cache exacta"]
    E --> F["pgvector"]
    F --> G["Cache semantica"]
    G --> H["Busqueda hibrida"]
    H --> I["RAG"]
    I --> J["Filtros de salida"]
    J --> K["Evaluaciones"]
```

## Definicion de terminado

Una etapa queda terminada cuando:

- el codigo compila y las migraciones son reproducibles;
- existen pruebas proporcionales al riesgo;
- RLS impide acceso entre hogares;
- los calculos financieros se validan contra SQL;
- no se guardan secretos ni datos financieros reales en Git;
- se actualiza la documentacion relacionada;
- existe un commit descriptivo;
- el resultado puede demostrarse.

## Criterios especiales para IA

- ninguna cifra se acepta sin recalcularla en PostgreSQL;
- ninguna respuesta cruza limites de hogar;
- toda respuesta indica periodo, moneda y fuentes;
- las acciones de escritura requieren confirmacion;
- un cambio financiero invalida la cache anterior;
- los cambios de modelo o prompt deben superar las evaluaciones.


