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

**Redeploy:**

```powershell
cd app
npx vercel --prod --scope marcspro
```

Opcional después: dominio custom `qa.zonacero.app` apuntando al mismo proyecto.

---

## 7. Producción — no tocar hasta Go-Live

Proyecto Supabase **prod** separado (`zona-cero-prod`); mismos SQL (`schema.sql`, seed adaptado). Sprint 7.

### Plan Supabase (decisión arquitectura)

| Proyecto | Rol | Plan |
|----------|-----|------|
| `zona-cero` | Staging / QA | **Free** (ahora) |
| `zona-cero-prod` | Gym real | **Pro** desde ~1–2 sem antes Go-Live |

Ver cronograma §8: [cronograma-desarrollo-avanzada.md](./cronograma-desarrollo-avanzada.md#8-decisión-de-arquitectura--supabase-plan-free-vs-pro).

El badge **main PRODUCTION** en el dashboard **no** hay que cambiarlo — no es el ambiente staging/prod del proyecto.

---

## Checklist Sprint 1 (SCRUM-15)

- [x] Proyecto Supabase staging (`zona-cero`) operativo
- [x] `schema.sql` / `seed.sql` / RLS / usuarios staging
- [x] Frontend QA en Vercel: https://zona-cero-qa.vercel.app
- [ ] Site URL + Redirect URLs en Supabase Auth (sección 6)
- [x] Login socio/staff/admin OK contra staging
