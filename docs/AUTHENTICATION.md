# Acceso familiar

Clara utiliza Supabase Auth con email y contraseña.

## Flujo

1. Una persona crea su cuenta.
2. Si Supabase exige confirmación, recibe un email y confirma su dirección.
3. Al iniciar sesión por primera vez, crea el nombre de su hogar.
4. El trigger `household_creator_membership` le asigna automáticamente el rol `owner`.
5. Las siguientes visitas recuperan la sesión almacenada por Supabase.
6. El botón **Salir** elimina la sesión local.

## Protección de datos

La interfaz no usa `service_role`. Todas las consultas se realizan con la clave publicable y quedan sujetas a Row Level Security. Un usuario solo puede consultar hogares de los que sea miembro.

## Archivos

- `app/auth-gate.tsx`: sesión, ingreso, registro y creación del hogar.
- `app/auth.css`: presentación responsive del acceso.
- `lib/supabase.ts`: cliente público de Supabase.
- `supabase/schema.sql`: membresías, roles y políticas RLS.

El onboarding utiliza los RPC `current_household()` y `create_household()`. La creación del hogar y de la membresía propietaria se resuelve de forma atómica y no depende de un `INSERT ... RETURNING` expuesto a RLS.

## Pendiente para producción

- Configurar la URL definitiva de Vercel en Authentication → URL Configuration.
- Personalizar las plantillas de email.
- Agregar recuperación de contraseña.
- Implementar invitaciones para miembros adicionales.
