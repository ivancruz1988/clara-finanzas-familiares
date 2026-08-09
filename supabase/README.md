# Configuración de Supabase

## Crear el entorno

1. Crear un proyecto en [Supabase](https://supabase.com/dashboard).
2. Abrir **SQL Editor → New query**.
3. Copiar y ejecutar `schema.sql` una sola vez.
4. En **Authentication → URL Configuration**, configurar:
   - Site URL local: `http://localhost:3000`
   - URL de producción: la dirección final de Vercel.
5. En **Project Settings → API**, copiar la URL y la clave pública `anon`.
6. Crear `.env.local` a partir de `.env.example`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=clave_publica
```

La clave `service_role` nunca debe usarse en el navegador ni guardarse en Git.

## Modelo de seguridad

Cada registro operativo pertenece a un `household`. Las políticas RLS permiten acceso únicamente a miembros de ese hogar. Quien crea el hogar se incorpora automáticamente como `owner` mediante un trigger con `security definer`.

El propietario puede agregar, actualizar y quitar otros miembros, pero no puede eliminar su propia membresía accidentalmente.

## Prueba mínima

Después de registrar un usuario desde la aplicación:

```sql
select auth.uid();
select * from public.households;
select * from public.household_members;
```

Crear un hogar debe producir exactamente una membresía con rol `owner`.

## Reinicio durante desarrollo

El archivo `schema.sql` está diseñado para una base nueva. Para cambios posteriores se crearán migraciones incrementales; no se debe volver a ejecutar sobre producción.
