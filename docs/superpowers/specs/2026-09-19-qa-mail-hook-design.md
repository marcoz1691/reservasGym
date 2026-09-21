# Interceptar los correos de Auth en QA — diseño

**Fecha:** 2026-09-19
**Ambiente afectado:** solo QA / staging (proyecto Supabase `zona-cero`)
**Relacionado:** ZCAPP-46 (recuperación de contraseña), `docs/tecnico/staging-setup.md`

## Problema

El proyecto usa el servicio de correo integrado de Supabase, limitado a **2 correos
por hora y por proyecto**, compartidos entre todos los tipos de correo. Probar el
flujo de recuperación de contraseña agota el cupo de inmediato: el 2026-09-19 un
correo de recuperación y una confirmación de registro bastaron para que el tercer
intento devolviera `429 over_email_send_rate_limit`.

QA es un ambiente de pruebas y no tiene sentido gastar envíos reales en
notificaciones de prueba. Lo que hace falta es **ver el enlace**, no recibir el
correo.

## Solución

Usar el **Send Email hook** de Supabase Auth en su variante de función Postgres.
El hook se ejecuta antes de cada envío; si responde sin error, Supabase considera
el correo entregado por un proveedor propio y **no envía nada**. La función guarda
los datos del evento en una tabla y devuelve `{}`.

Consecuencias:

- Cero correos salen del proyecto en QA.
- El tope de 2/hora desaparece: según la
  [tabla de rate limits](https://supabase.com/docs/guides/auth/rate-limits), el
  límite `rate_limit_email_sent` pasa a ser configurable en cuanto existe un Send
  Email hook.
- El hook está disponible en plan **Free**, así que no implica upgrade.
- Cubre los tres tipos de correo que existen hoy: `recovery`, `signup` y
  `email_change`. La app no tiene notificaciones propias, así que no hay más.

El enlace se reconstruye con los campos del payload:

```text
https://<project-ref>.supabase.co/auth/v1/verify
  ?token=<token_hash>&type=<email_action_type>&redirect_to=<redirect_to>
```

## Arquitectura

Un schema dedicado **`qa_mail`**, deliberadamente fuera de `public`.

`public` queda expuesto por PostgREST en `/rest/v1/`, y esta tabla contiene tokens
de un solo uso que permiten fijar la contraseña de una cuenta. Un schema no
expuesto no es alcanzable por la API REST ni con la anon key. Es la misma razón por
la que el 2026-09-19 se cerró el acceso anónimo a las funciones de `public`
(ver `app/supabase/fix-function-grants.sql`).

| Objeto | Propósito |
|---|---|
| `qa_mail.sent` | Hechos: una fila por correo interceptado, con el payload crudo |
| `qa_mail.enlaces` | Vista de lectura: fecha, tipo, correo destino, enlace armado y OTP |
| `qa_mail.send_email_hook(event jsonb)` | La función que Auth invoca |

La tabla guarda datos crudos y la vista arma la URL. Así el dominio del proyecto
vive en un solo lugar y la tabla no queda atada al formato del enlace.

### Permisos

Siguiendo el [modelo de seguridad de los Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks),
la función **no** usa `security definer`. En su lugar se le dan privilegios
explícitos al rol que la invoca:

- `supabase_auth_admin`: `usage` en el schema, `execute` en la función,
  `insert/select/delete` en la tabla.
- `public`, `anon`, `authenticated`: sin `usage` en el schema ni `execute` en la
  función. Un schema nuevo no otorga `usage` a `PUBLIC` por defecto; los revokes
  se dejan igual de forma explícita.

No se activa RLS en `qa_mail.sent`: el aislamiento lo da el schema no expuesto y la
ausencia de `usage`. Activar RLS bloquearía los inserts de `supabase_auth_admin`
(que no es dueño de la tabla) y obligaría a una política extra sin ganancia real.

### Retención

La función borra las filas de más de 7 días en cada inserción. Evita acumular
tokens indefinidamente sin necesidad de un job programado.

## Riesgo principal: no debe llegar nunca a producción

Con el hook activo, Supabase **deja de enviar correos por completo**. Si quedara
activo en producción, ningún socio recibiría su enlace de recuperación y fallaría
en silencio: la app seguiría mostrando «enlace enviado» con normalidad.

El hook no puede delegar el envío de vuelta a Supabase; una vez configurado, o
envía el hook o no se envía nada. Por eso no sirve un guard en tiempo de ejecución
y la protección tiene que ser estructural:

1. **Proyectos separados.** Producción será `zona-cero-prod`, un proyecto Supabase
   distinto. El hook se activa por proyecto desde el dashboard, así que basta con
   no activarlo ahí.
2. **Fuera de `schema.sql`.** El SQL vive en `app/supabase/qa-mail-hook.sql` y no se
   incorpora al esquema base, de modo que prod no hereda ni la función al aplicar
   `schema.sql`.
3. **Ítem en el checklist de Go-Live.** Verificar que Authentication → Hooks esté
   vacío y que haya SMTP propio configurado.

## Contrapartida aceptada

Mientras el hook esté activo, **nadie recibe correos en QA**. Si el cliente o
recepción prueban un registro en `zona-cero-qa.vercel.app`, la confirmación no les
llegará y habrá que pasarles el enlace desde la tabla. Si estorba para una demo, la
alternativa es desactivar «Confirm email» en QA para que el registro no la pida.

Decisión: se acepta. QA es ambiente de pruebas.

## Camino a producción

Sin cambios de código. En `zona-cero-prod` no se activa el hook y se configura SMTP
propio en Project Settings → Authentication → SMTP (Resend o Brevo; capa gratuita
suficiente). Las plantillas de correo son las mismas.

Opción futura, fuera de alcance: migrar el hook a su variante HTTP contra una Edge
Function que envíe por API con plantillas propias en español. Da más control sobre
el diseño del correo, pero agrega piezas y hoy no hace falta.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Buzón de pruebas (Mailtrap) como SMTP propio | Resuelve el cupo y muestra el correo renderizado, pero suma una cuenta y credenciales externas para algo que una tabla resuelve dentro del proyecto |
| Seq | Es un servidor de logs que habría que hospedar, y no intercepta los correos por sí solo: igual haría falta el hook. El hook tendría que escribirle a Seq en vez de a una tabla, sumando infraestructura sin ganancia |
| Datadog (ya conectado) | Mismo caso que Seq. Tiene sentido para observabilidad general, no para leer un enlace en QA |
| Leer el enlace de los logs de Supabase | No sirve: el log de `mail.send` no incluye el enlace, y el token solo aparece en los logs cuando alguien ya hizo clic |

## Pasos

| # | Paso | Quién |
|---|---|---|
| 1 | Crear schema, tabla, vista, función y permisos | agente (MCP) |
| 2 | Activar el hook en Authentication → Hooks → Send Email → Postgres function `qa_mail.send_email_hook` | manual (dashboard) |
| 3 | Subir `rate_limit_email_sent` en Authentication → Rate Limits | manual (dashboard) |
| 4 | Pedir una recuperación real y leer el enlace desde `qa_mail.enlaces` | conjunto |

## Criterios de aceptación

- [ ] `anon` y `authenticated` no pueden leer `qa_mail.sent` ni ejecutar la función
- [ ] `supabase_auth_admin` puede ejecutar la función e insertar en la tabla
- [ ] Una petición de recuperación deja una fila en `qa_mail.sent` y **ningún**
      `mail.send` en los logs de Auth
- [ ] El enlace de `qa_mail.enlaces` abre `/recuperar` con el formulario y permite
      fijar la contraseña
- [ ] Pedir más de 2 recuperaciones en una hora ya no devuelve `429`
- [ ] Las filas de más de 7 días se eliminan solas
