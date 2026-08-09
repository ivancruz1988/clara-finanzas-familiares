# Seguridad, privacidad y controles de IA

## Modelo de confianza

- El navegador no es confiable.
- Los parámetros del usuario no conceden permisos.
- PostgreSQL y RLS son la autoridad de acceso.
- La salida del modelo no es confiable hasta ser validada.
- El contenido recuperado es información, nunca instrucciones del sistema.

## Aislamiento por hogar

Toda tabla expuesta debe tener RLS. Las consultas financieras, vectoriales y de caché sólo devuelven filas cuyo `household_id` pertenece al usuario autenticado. Se prueban explícitamente accesos cruzados.

## Secretos

- claves administrativas y de modelos: sólo servidor o Edge Functions;
- `.env.local`: nunca en Git;
- clave pública de Supabase: permitida con RLS correcto;
- `service_role`: nunca en el navegador.

## Privacidad

Redactar en respuestas y registros:

- números completos de tarjeta, CBU y CVU;
- documentos personales;
- tokens, claves y contraseñas;
- datos de otro hogar;
- contenido financiero innecesario para diagnóstico.

## Acciones de IA

La IA puede proponer, pero requieren confirmación explícita:

- crear, editar o eliminar movimientos;
- marcar pagos;
- modificar saldos o presupuestos;
- invitar miembros;
- importaciones masivas.

La confirmación incluye entidad, importe, moneda, fecha y efecto esperado. Las operaciones usan idempotencia y generan auditoría.

## Protección contra prompt injection

- separar instrucciones del sistema, pregunta y documentos;
- etiquetar cada fragmento como contenido no confiable;
- ignorar instrucciones encontradas en comprobantes o notas;
- permitir únicamente herramientas definidas;
- validar argumentos de herramientas;
- verificar fuentes y permisos después de la recuperación.

## Límites y abuso

- rate limit por usuario y hogar;
- límite de longitud de consulta y contexto;
- límite de resultados recuperados;
- timeout y presupuesto de coste;
- bloqueo de consultas repetitivas abusivas;
- mensajes seguros ante fallos, sin detalles internos.

## Respuesta ante fallos

Si faltan fuentes, hay baja confianza, versiones antiguas o discrepancias numéricas, Clara no inventa. Solicita aclaración o informa que no puede validar la respuesta.

## Pruebas mínimas

1. Usuario A no accede al hogar B.
2. La caché nunca cruza hogares.
3. Un embedding no evita RLS.
4. Un documento malicioso no cambia instrucciones.
5. Un importe incorrecto del modelo se bloquea.
6. Una respuesta vencida no se reutiliza.
7. Una acción sin confirmación no se ejecuta.
8. Los logs no contienen secretos ni datos completos.
