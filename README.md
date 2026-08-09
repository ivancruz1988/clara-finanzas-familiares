# Clara — Finanzas familiares

Aplicación web inspirada en la planilla `Presupuesto_Familiar_Cruz_2026`. Reúne presupuesto mensual, movimientos en efectivo y bancos, órdenes de pago, saldos y disponible proyectado.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md)
- [Plan diario](docs/ROADMAP.md)
- [Estado actual](docs/STATUS.md)
- [Estructura y convenciones](docs/PROJECT_STRUCTURE.md)
- [Sistema visual](docs/VISUAL_SYSTEM.md)
- [Guía de contribución](CONTRIBUTING.md)

## Desarrollo local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Sin variables de entorno funciona en **modo demo** con datos de ejemplo. Para persistencia:

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL Editor.
3. Copiar URL y clave anónima en `.env.local`.
4. Activar autenticación por email en Supabase.

## Publicación

Subir este repositorio a GitHub, importarlo en Vercel y agregar las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Project Settings → Environment Variables.

## Funciones incluidas

- Resumen de disponible total, pagos pendientes y disponible proyectado.
- Presupuesto planificado vs. gasto real por categoría.
- Registro y listado de movimientos.
- Saldos por cuenta y medio de pago.
- Órdenes de pago pendientes/pagadas.
- Diseño responsive para celular y escritorio.
- Esquema PostgreSQL multiusuario con RLS para Supabase.

La interfaz actual usa datos demo; el esquema y cliente Supabase están listos para conectar la capa de persistencia y autenticación.
