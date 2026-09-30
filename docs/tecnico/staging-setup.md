# Ambiente Staging — Zona Cero Performance Center

**Staging = QA.** Un solo proyecto Supabase de pruebas; no hace falta un ambiente QA separado.

| Capa | Uso | Cuándo |
|------|-----|--------|
| **Local** | Dev diario (`npm run dev` sin Supabase → LocalRepository) | Siempre |
| **Staging / QA** | BD real, RLS, Auth, demos y QA profesional | **Sprint 1 en adelante** |
| **Producción** | Gym real | Sprint 7 / Go-Live |

**Flujo:** `local` → `QA` (validar en Jira: *Listo para pruebas*) → `prod`

**URL fija QA (oficial):** https://zona-cero-qa.vercel.app

---

## 1. Crear proyecto Supabase Staging (una vez)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Nombre: `zona-cero` (o `zona-cero-staging`)
3. Región: **South America (São Paulo)** (más cercana a Ecuador)
4. Guardar **Project URL** y **anon public key** (Settings → API)

---

## 2. Aplicar schema y seed

### Opción A — MCP Supabase en Cursor (recomendado)

1. Ya está en `~/.cursor/mcp.json` → servidor `supabase`
2. Cursor → **Settings → Tools & MCP → supabase → Authenticate** (OAuth)
3. Reinicia Cursor si no aparecen herramientas
4. Pide al agente: *"provisiona staging con MCP"*

### Opción B — Script automático (`npm run provision:staging`)

1. [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → token con **Database Read+Write**
2. Settings → General → copia **Reference ID**
3. PowerShell:

```powershell
cd app
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
$env:SUPABASE_PROJECT_REF = "tu-reference-id"
npm run provision:staging
```

Tras crear usuarios Auth (sección 3), elevar roles:

```powershell
$env:RUN_STAGING_USERS = "1"
npm run provision:staging
```

### Opción C — SQL Editor manual

En **SQL Editor** del proyecto staging, ejecutar en orden:

1. `app/supabase/schema.sql` — tablas + RLS + triggers
1. `app/supabase/booking-rpc.sql` — reservas y lista de espera atómicas (`book_session`, `cancel_booking`)
2. `app/supabase/seed.sql` — catálogo Zona Cero (8 áreas, planes demo)
3. `app/supabase/staging-users.sql` — roles staff/admin *(después del paso 3)*

---

## 3. Usuarios de prueba (Auth)

Authentication → Users → **Add user** (marcar **Auto Confirm**):

| Email | Rol final | Contraseña staging |
|-------|-----------|-------------------|
| `socio.staging@zonacero.test` | member | `ZonaCero2026!` |
| `staff.staging@zonacero.test` | staff | `ZonaCero2026!` |
| `admin.staging@zonacero.test` | admin | `ZonaCero2026!` |

Luego ejecutar `staging-users.sql` para elevar roles.

---

## 4. Configurar la app local → staging (solo desarrollo)

```powershell
cd app
copy .env.staging.example .env.staging
# Editar .env.staging con URL y anon key del proyecto staging
npm run dev:staging
```

Abrir `http://localhost:5190` e iniciar sesión con las cuentas staging.

> **Puertos Zona Cero:** `npm run dev` → **5180** (local) · `npm run dev:staging` → **5190** (Supabase). MIA u otros proyectos pueden seguir en 5173.

---

## 5. Columna Jira «Listo para pruebas»

| Columna | Dónde probar |
|---------|----------------|
| En curso | Local o `npm run dev:staging` |
| **Listo para pruebas** | **https://zona-cero-qa.vercel.app** + checklist del ticket |
| Finalizado | Mismo ambiente; criterios de aceptación OK |

Al mover un ticket a *Listo para pruebas*, el comentario debe incluir:
- URL: `https://zona-cero-qa.vercel.app`
- Usuario/contraseña de prueba
- Checklist DoD (3–5 ítems)

---

## 6. Frontend QA (URL pública fija) — operativo

| Ítem | Valor |
|------|-------|
| **URL fija QA** | **https://zona-cero-qa.vercel.app** |
| Proyecto Vercel | `marcspro/zona-cero-qa` |
| Backend | Mismo Supabase staging (`zona-cero`) |
| Env en Vercel | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

**Cómo probar (QA profesional / William / recepción):** abrir la URL en desktop o celular (Safari/Chrome). No hace falta clonar el repo ni Node. Opcional: «Añadir a pantalla de inicio» para sensación de app (sigue siendo web).

**Auth redirects (Supabase Dashboard → Authentication → URL Configuration):**
- Site URL: `https://zona-cero-qa.vercel.app`
- Redirect URLs: `https://zona-cero-qa.vercel.app/**` y `http://localhost:5190/**`

> **Pendiente y crítico para recuperación de contraseña (ZCAPP-46).** Mientras el
> Site URL siga en el default `http://localhost:3000` y la URL de QA no esté en la
> lista, Supabase **descarta** el `redirect_to` que manda la app y lo reemplaza por
> el Site URL. El enlace del correo sale apuntando a un `localhost:3000` donde no
> hay nada y el socio ve un error, aunque el token se canjee bien. Verificado en
> los logs del proyecto el 2026-09-19: la app pidió
> `recover?redirect_to=https://zona-cero-qa.vercel.app/recuperar` y el correo llegó
> con `verify?...&redirect_to=http://localhost:3000`.

**Redeploy:**

```powershell
cd app
npx vercel --prod --scope marcspro
```

Opcional después: dominio custom `qa.zonacero.app` apuntando al mismo proyecto.

---

## 6b. Correos de Auth en QA — no se envían, se registran

El correo integrado de Supabase permite **2 envíos por hora y por proyecto**,
compartidos entre todos los tipos. Probar recuperación de contraseña agota el cupo
al instante (`429 over_email_send_rate_limit`). QA es ambiente de pruebas y no
tiene sentido gastar envíos reales en notificaciones de prueba.

Por eso QA usa un **Send Email hook** (`app/supabase/qa-mail-hook.sql`): Supabase
llama a una función Postgres antes de cada envío, la función guarda el enlace y
devuelve vacío, y Supabase **no envía nada**. Como efecto secundario desaparece el
tope de 2/hora.

Para leer el enlace, en el SQL Editor:

```sql
select * from qa_mail.enlaces;
```

Devuelve fecha, tipo (`recovery`, `signup`, `email_change`), correo destino, el
enlace listo para abrir y el código OTP. Las filas se borran solas a los 7 días.

**Olvido de contraseña:** la app pide un **código de 6 dígitos**, no un enlace.
Para probarlo en QA, tras tocar «Enviar código» en la app:

```sql
select codigo_otp from qa_mail.enlaces where tipo = 'recovery' and correo = 'socio.staging@zonacero.test' limit 1;
```

La plantilla del correo con el código está en
`app/supabase/email-templates/recovery.html` (Authentication → Email Templates →
Reset Password) y el largo en Authentication → Email → **Email OTP Length = 6**.

| Ítem | Valor |
|------|-------|
| Activación | Authentication → Hooks → Send Email → Postgres function `qa_mail.send_email_hook` |
| Rate limit | Authentication → Rate Limits → `rate_limit_email_sent` (configurable al existir el hook) |
| Diseño | [spec](../superpowers/specs/2026-09-19-qa-mail-hook-design.md) |

> **Contrapartida.** Mientras el hook esté activo **nadie recibe correos en QA**. Si
> el cliente o recepción prueban un registro, la confirmación no les llega y hay que
> pasarles el enlace desde `qa_mail.enlaces`.
>
> **Registro en QA (recomendado):** Authentication → Providers → Email → desactivar
> **Confirm email**. Así el signup no dispara correo ni choca con
> `email rate limit exceeded`. El olvido de contraseña sigue usando el hook
> (`qa_mail.enlaces`). En producción se deja Confirm email **activado**.
>
> Si Confirm email sigue activo, sube también Authentication → Rate Limits →
> `rate_limit_email_sent` (solo tiene efecto con el Send Email hook configurado).

---

## 7. Producción

Creado el 2026-09-27. Separado de QA en todo: otro proyecto de Vercel y otro de Supabase.

| | QA | Producción |
|---|---|---|
| Vercel | `zona-cero-qa` | `zona-cero-prod` (antes `reservas-gym`) |
| Rama | `main` (cada merge) | `production` (solo cuando QA aprueba) |
| Build | `npm run build:staging` (login con cuentas demo) | `npm run build` (sin cuentas demo) |
| Supabase | `zona-cero` · `kqhmclbexnnsbzbgerbx` | `zona-cero-prod` · `gvgqlmoulgcickxognto` |

**Vercel `zona-cero-prod`:** preset Vite, Root Directory `app`, Branch Tracking `production`.
Ignored Build Step:

```bash
if [ "$VERCEL_GIT_COMMIT_REF" = "production" ] && [ -n "$VITE_SUPABASE_URL" ]; then exit 1; else exit 0; fi
```

Solo compila la rama `production` y solo si tiene `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Environment Variables → Production).

**Supabase `zona-cero-prod`**, SQL aplicado en este orden:

1. `app/supabase/schema.sql`
2. `app/supabase/booking-rpc.sql`
3. `app/supabase/seed-prod.sql` — configuración, 9 áreas y plantillas, **sin** entrenadores ni planes de ejemplo
4. `app/supabase/planes-zona-cero.sql` — catálogo comercial real

**No** aplicar `seed.sql`, `staging-users.sql` ni `qa-mail-hook.sql` en prod.

**Publicar una versión:** cuando QA valida `main`, abrir un PR `main` → `production` y hacer merge. Vercel despliega prod.

### Plan Supabase (decisión arquitectura)

| Proyecto | Rol | Plan |
|----------|-----|------|
| `zona-cero` | Staging / QA | **Free** (ahora) |
| `zona-cero-prod` | Gym real | **Free** hoy → **Pro** ≈ 05 Dic 2026 (ZCAPP-59) |

Ver cronograma §8: [cronograma-desarrollo-avanzada.md](./cronograma-desarrollo-avanzada.md#8-decisión-de-arquitectura--supabase-plan-free-vs-pro).

El badge **main PRODUCTION** en el dashboard **no** hay que cambiarlo — no es el ambiente staging/prod del proyecto.

### Correos en producción — verificación obligatoria

El hook de QA de la sección 6b **no debe existir en `zona-cero-prod`**. Con el hook
activo Supabase deja de enviar correos por completo y falla en silencio: la app
sigue mostrando «enlace enviado» y ningún socio recibe nunca su recuperación.

Por eso `qa-mail-hook.sql` está fuera de `schema.sql` y prod no lo hereda al aplicar
el esquema. Antes del Go-Live hay que confirmar:

- [ ] Authentication → Hooks **vacío** (sin Send Email hook)
- [ ] Project Settings → Authentication → **SMTP propio** configurado y probado
- [ ] El schema `qa_mail` **no** existe en prod
- [ ] Email Templates → **Reset Password** con el código (`app/supabase/email-templates/recovery.html`). Supabase solo deja editarla con SMTP propio o plan Pro; sin ella el correo lleva un enlace y la recuperación de la app no funciona. Email OTP Length = 6 (ya aplicado).
- [ ] Site URL y Redirect URLs apuntan al dominio real, no a QA

---

## 8. Pago en línea con Pagomedios (en desarrollo local)

Alcance, flujo y exclusiones: [pagomedios-plan-1-pago-unico.md](./pagomedios-plan-1-pago-unico.md)
y [pagomedios-plan-2-recurrencia.md](./pagomedios-plan-2-recurrencia.md).

**Hoy corre solo en local.** No hay función desplegada ni variables en Vercel. En QA
se aplicó únicamente `app/supabase/pagomedios-provider.sql` (agrega `'pagomedios'` a
`payments_provider_check`).

### Correrlo en local contra el sandbox de Pagomedios

1. `app/.env.pagomedios.local` (git lo ignora):

   ```bash
   PAGOMEDIOS_TOKEN=<token de pruebas de Pagomedios>
   SUPABASE_URL=https://kqhmclbexnnsbzbgerbx.supabase.co
   SUPABASE_ANON_KEY=<anon de QA>
   SUPABASE_SERVICE_ROLE_KEY=<service_role de QA>
   APP_URL=http://localhost:5173
   FUNCTION_PUBLIC_URL=http://localhost:8000
   PAGOMEDIOS_TAX_RATE=0.15
   ```

2. `app/.env.staging.local`: las `VITE_SUPABASE_*` de QA más
   `VITE_ONLINE_PAYMENTS=1`, `VITE_PAYMENT_PROVIDER=pagomedios` y
   `VITE_FUNCTIONS_URL=http://localhost:8000`.
3. En dos terminales, desde `app/`: `npm run pagomedios:fn` (Edge Function con Deno, puerto 8000) y
   `npm run dev:staging` (app en `localhost:5173`).
4. Entrar como `socio.staging`, ir a Mi Plan → **Pagar en línea**, y pagar con las tarjetas de
   prueba que entrega Pagomedios.

Sin credenciales: `npm run pagomedios:e2e` levanta un Supabase falso y un simulador de
Pagomedios y prueba la función de punta a punta (aprobado, rechazado, notify repetido,
concurrencia, seguridad, app nativa).

**Sandbox:** se rechazan los montos $2, $3, $4, $5, $50, $999 y $1000. En QA sirven
"Zero Start Mensual" ($15, aprobado) y "Zona Day Musculación" ($2, rechazado).

**Qué observamos en el sandbox (30-sep-2026):**
- El retorno (`notify_url`) lo envía el **navegador del socio** (form POST), no el servidor de
  Pagomedios. Por eso funciona con `localhost`.
- Un pago rechazado no vuelve a la app: Pagomedios muestra "Tarjeta Invalida" y deja al socio
  en su página para reintentar. El pago queda "Pendiente" en Cobros.
- La tarjeta Mastercard de prueba fue rechazada incluso con montos válidos; la Visa aprueba.
  Confirmar con Pagomedios.

### Pasos para activarlo en QA (cuando se apruebe, no antes)

- [ ] `supabase functions deploy pagomedios-payment --no-verify-jwt --project-ref kqhmclbexnnsbzbgerbx`
      (sin JWT del gateway porque el retorno de Pagomedios llega sin sesión; create/verify validan
      la sesión dentro de la función).
- [ ] Secrets de la función: `PAGOMEDIOS_TOKEN`, `APP_URL=https://zona-cero-qa.vercel.app`,
      `PAGOMEDIOS_TAX_RATE=0.15`.
- [ ] Vercel `zona-cero-qa`: `VITE_ONLINE_PAYMENTS=1`, `VITE_PAYMENT_PROVIDER=pagomedios`.

### Go-Live (producción)

- [ ] Aplicar `pagomedios-provider.sql` en `zona-cero-prod`.
- [ ] Token **de producción** de Pagomedios (contrato del gimnasio) como secret; nunca el de pruebas.
- [ ] Deploy de la función en prod con `APP_URL` del dominio real.
- [ ] Variables `VITE_ONLINE_PAYMENTS` / `VITE_PAYMENT_PROVIDER` en `zona-cero-prod`.
- [ ] Un pago real de monto bajo y su reverso desde el panel de Pagomedios.

---

## Checklist Sprint 1 (SCRUM-15)

- [x] Proyecto Supabase staging (`zona-cero`) operativo
- [x] `schema.sql` / `seed.sql` / RLS / usuarios staging
- [x] Frontend QA en Vercel: https://zona-cero-qa.vercel.app
- [ ] Site URL + Redirect URLs en Supabase Auth (sección 6)
- [x] Login socio/staff/admin OK contra staging
