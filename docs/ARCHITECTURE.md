# Arquitectura del proyecto

## Objetivo

Reemplazar la planilla `Presupuesto_Familiar_Cruz_2026` por una aplicación web familiar, accesible desde celular y escritorio, con información centralizada y cálculos automáticos.

## Componentes

```text
Usuario
  ↓
Next.js en Vercel
  ↓
Supabase Auth + PostgreSQL + Row Level Security
```

- **Frontend:** Next.js 15, React 19 y TypeScript.
- **Interfaz:** CSS responsive y componentes propios.
- **Base de datos:** PostgreSQL administrado por Supabase.
- **Autenticación:** Supabase Auth mediante email.
- **Seguridad:** RLS por grupo familiar.
- **Alojamiento:** Vercel.
- **Código y seguimiento:** GitHub.

## Módulos funcionales

1. **Resumen:** efectivo, bancos, compromisos y disponible proyectado.
2. **Movimientos:** ingresos y gastos reales por fecha, categoría y cuenta.
3. **Presupuesto:** plan mensual, inflación prevista y comparación contra lo real.
4. **Cuentas:** efectivo, bancos y billeteras virtuales.
5. **Órdenes de pago:** vencimientos, cuenta de origen y estado.
6. **Familia:** usuarios que comparten el mismo hogar con permisos controlados.

## Modelo de datos

- `households`: grupos familiares.
- `household_members`: usuarios y roles.
- `accounts`: efectivo, bancos y billeteras.
- `categories`: categorías de ingreso y gasto.
- `transactions`: movimientos reales.
- `payment_orders`: pagos programados.
- `monthly_budgets`: presupuesto por categoría y mes.

El esquema inicial está en `supabase/schema.sql`.

## Reglas principales

- Disponible total = suma de saldos de cuentas.
- Pagos pendientes = suma de órdenes con estado `pending`.
- Disponible proyectado = disponible total − pagos pendientes.
- Gasto mensual = suma de transacciones de tipo `expense` dentro del mes.
- Variación presupuestaria = presupuesto − gasto real.

## Ambientes

- **Local:** modo demo o Supabase de desarrollo.
- **Preview:** despliegue automático de cada pull request en Vercel.
- **Producción:** rama `main`, Supabase de producción y dominio definitivo.

Nunca se deben versionar `.env.local`, claves privadas ni datos financieros reales.
