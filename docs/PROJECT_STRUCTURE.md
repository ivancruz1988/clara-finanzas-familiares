# Estructura del repositorio

```text
finanzas-personales/
├── app/                 # Páginas, componentes y estilos de Next.js
├── lib/                 # Tipos, cliente Supabase y datos demo
├── supabase/            # Esquema y futuras migraciones SQL
├── docs/                # Arquitectura, roadmap y decisiones
├── public/              # Recursos estáticos (cuando se incorporen)
├── .env.example         # Variables requeridas, sin secretos
├── package.json         # Dependencias y comandos
└── README.md            # Entrada principal del proyecto
```

## Convenciones

- Componentes React: `PascalCase`.
- Funciones y variables: `camelCase`.
- Archivos SQL incrementales: `YYYYMMDD_descripcion.sql`.
- Ramas: `codex/<tipo>-<descripcion>`.
- Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:` o `chore:`.

## Flujo de trabajo

1. Crear una rama desde `main`.
2. Implementar una unidad pequeña.
3. Ejecutar `npm run build`.
4. Abrir un pull request.
5. Revisar el preview de Vercel.
6. Integrar a `main`.
