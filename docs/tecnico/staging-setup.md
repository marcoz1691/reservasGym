# Ambiente Staging — Zona Cero Performance Center

**Staging = QA.** Un solo proyecto Supabase de pruebas; no hace falta un ambiente QA separado.

| Capa | Uso | Cuándo |
|------|-----|--------|
| **Local** | Dev diario (`npm run dev` sin Supabase → LocalRepository) | Siempre |
| **Staging** | BD real, RLS, Auth, demos a William | **Sprint 1 en adelante** |
| **Producción** | Gym real | Sprint 7 / Go-Live |

**Flujo:** `local` → `staging` (validar en Jira: *Listo para pruebas*) → `prod`

---

## 1. Crear proyecto Supabase Staging (una vez)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Nombre: `zona-cero-staging`
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

## 4. Configurar la app local → staging

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
| En curso | Local (LocalRepository o staging) |
| **Listo para pruebas** | **`npm run dev:staging`** + checklist del ticket |
| Finalizado | Mismo ambiente; criterios de aceptación OK |

Al mover un ticket a *Listo para pruebas*, el comentario debe incluir:
- Comando: `npm run dev:staging`
- Usuario/contraseña de prueba
- Checklist DoD (3–5 ítems)

---

## 6. Frontend desplegado (URL pública) — Sprint 2–3

Cuando haya demo para William (membresías / panel recepción):

- Deploy en Vercel/Netlify con variables `VITE_SUPABASE_*` del **mismo** proyecto staging
- URL sugerida: `staging.zonacero.app` o preview de Vercel

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

- [ ] Proyecto `zona-cero-staging` creado
- [ ] `schema.sql` aplicado sin errores
- [ ] `seed.sql` aplicado (8 zonas + planes visibles)
- [ ] RLS activo en todas las tablas (`alter table ... enable row level security`)
- [ ] 3 usuarios staging creados + `staging-users.sql` ejecutado
- [ ] `.env.staging` configurado
- [ ] `npm run dev:staging` — login socio y staff OK
