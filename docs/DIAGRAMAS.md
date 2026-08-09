# Diagramas del proyecto

## Arquitectura general

```mermaid
flowchart TB
    U["Usuario familiar<br/>Celular o computadora"]
    subgraph FRONT["Aplicación web - Next.js"]
        AUTH["Registro e inicio de sesión"]
        HOME["Selección del hogar"]
        DASH["Resumen financiero"]
        ACC["Cuentas<br/>Efectivo · Bancos · Billeteras"]
        CAT["Categorías<br/>Ingresos · Gastos"]
        MOV["Movimientos"]
        BUD["Presupuesto mensual"]
        PAY["Pagos programados"]
    end
    subgraph SUPA["Supabase"]
        SAUTH["Supabase Auth<br/>Usuarios y sesiones"]
        RPC["Funciones seguras RPC<br/>Crear y consultar hogar"]
        HH[("households")]
        HM[("household_members")]
        AC[("accounts")]
        CA[("categories")]
        TR[("transactions")]
        MB[("monthly_budgets")]
        PO[("payment_orders")]
        RLS["Row Level Security<br/>Aislamiento por hogar"]
    end
    HOST["Vercel<br/>Aplicación publicada"]
    CODE["GitHub<br/>Código y pull requests"]
    U --> HOST --> AUTH
    AUTH <--> SAUTH
    AUTH --> HOME <--> RPC
    RPC <--> HH
    RPC <--> HM
    HOME --> DASH
    DASH --> ACC & CAT & MOV & BUD & PAY
    ACC <--> AC
    CAT <--> CA
    MOV <--> TR
    BUD <--> MB
    PAY <--> PO
    RLS -. protege .-> HH & HM & AC & CA & TR & MB & PO
    CODE --> HOST
```

## Flujo funcional

```mermaid
flowchart LR
    A["Crear usuario"] --> B["Confirmar email"]
    B --> C["Iniciar sesión"]
    C --> D{"¿Tiene hogar?"}
    D -- "No" --> E["Crear hogar"]
    E --> F["Asignar usuario como propietario"]
    D -- "Sí" --> G["Cargar información familiar"]
    F --> G
    G --> H["Crear cuentas y categorías"]
    H --> I["Registrar movimientos"]
    I --> J["Planificar presupuesto"]
    J --> K["Programar pagos"]
    K --> L["Consultar tablero financiero"]
```

## Cálculos principales

- Disponible total = suma de los saldos de las cuentas.
- Disponible proyectado = disponible total - pagos pendientes.
- Cada usuario accede solamente a los datos de su hogar mediante las políticas RLS de Supabase.
