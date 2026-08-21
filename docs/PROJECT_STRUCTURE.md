# Estructura objetivo del repositorio

```text
finanzas-personales/
├── app/
│   ├── api/assistant/route.ts       # Entrada segura al asistente
│   ├── cuentas/                     # Rutas de cuentas
│   ├── movimientos/                 # Rutas de movimientos
│   ├── presupuesto/                 # Rutas de presupuesto
│   └── pagos/                       # Rutas de pagos
├── components/
│   ├── accounts/                    # Componentes de cuentas
│   ├── transactions/                # Componentes de movimientos
│   ├── budget/                      # Componentes de presupuesto
│   ├── payments/                    # Componentes de pagos
│   ├── assistant/                   # Contratos, RAG, cache, busqueda, rate limit y estados
│   └── ui/                          # Componentes visuales reutilizables
├── features/
│   ├── accounts/                    # Servicio, consultas y validación
│   ├── transactions/
│   ├── budgets/
│   └── payments/
├── lib/
│   ├── supabase/                    # Cliente web, servidor y tipos
│   ├── finance/                     # Cálculos deterministas
│   ├── ai/                          # RAG, filtros, caché y guardas
│   └── security/                    # Permisos, redacción y rate limit
├── supabase/
│   ├── migrations/                  # Migraciones incrementales
│   ├── functions/                   # Edge Functions
│   ├── seed.sql                     # Datos de demostración
│   └── schema.sql                   # Esquema de referencia
├── tests/
│   ├── unit/                        # Cálculos y normalización
│   ├── integration/                 # Supabase y API
│   ├── security/                    # Aislamiento por hogar
│   └── ai-evals/                    # Calidad de respuestas
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AI_RAG_ARCHITECTURE.md
│   ├── DATA_DICTIONARY.md
│   ├── SECURITY.md
│   └── adr/                         # Decisiones arquitectónicas
└── scripts/                         # Seed, diagramas y evaluaciones
```

## Responsabilidades

- `app` coordina rutas y renderizado; no contiene reglas financieras.
- `components` presenta datos; no consulta directamente tablas sensibles.
- `features` contiene casos de uso, validación y acceso a datos por módulo.
- `lib/finance` es la única fuente de cálculos compartidos.
- `lib/ai` interpreta consultas, recupera contexto y valida salidas.
- `lib/security` aplica controles transversales.
- `supabase/migrations` es la fuente reproducible del esquema remoto.
- `tests/ai-evals` impide regresiones al cambiar modelos o prompts.

## Flujo entre capas

```text
Componente -> caso de uso -> validación -> repositorio Supabase -> PostgreSQL
Chat -> API servidor -> filtros -> caché/RAG/SQL -> guarda de salida -> respuesta
```

## Convenciones

- React: `PascalCase`; funciones y variables: `camelCase`.
- Migraciones: `YYYYMMDD_descripcion.sql`.
- Ramas: `codex/<tipo>-<descripcion>`.
- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:` o `chore:`.
- Los contratos externos se validan mediante esquemas tipados.
- Los prompts se versionan y no contienen secretos.

