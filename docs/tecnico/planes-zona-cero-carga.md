# Carga de planes comerciales — Zona Cero

Flujo cuando William envía la tabla de membresías (Sprint 2 / ZCAPP-16).

---

## 1. Recibir y documentar (PM)

William completa la matriz. Guardar copia en este repo:

| Plan | Precio USD | Duración | Acceso | Áreas incluidas | Notas |
|------|-----------|----------|--------|-----------------|-------|
| *(ejemplo abajo)* | | | | | |

**Áreas válidas** (IDs en BD):

| Área | ID Supabase |
|------|-------------|
| Gimnasio | `zone-gimnasio` |
| Fisioterapia | `zone-fisio` |
| Nutrición | `zone-nutri` |
| Bailoterapia | `zone-bailo` |
| Dragon Fit | `zone-dragon-fit` |
| Áreas comunes | `zone-comunes` |
| Hyrox | `zone-hyrox` |
| Musculación | `zone-muscu` |
| CrossFit | `zone-crossfit` |

- **Acceso total:** `allowed_zone_ids = '{}'` (array vacío)
- **Visitas ilimitadas:** `visit_quota = null`
- **Pase por visitas:** `visit_quota = N` (ej. 10)

---

## 2. Cargar en Supabase staging

### Opción A — SQL (recomendado, reproducible)

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard) → proyecto **zona-cero** (staging)
2. **SQL Editor** → New query
3. Pegar el contenido de `app/supabase/planes-william-ejemplo.sql` *(prueba)* o el SQL definitivo que armes con la tabla real
4. **Run**
5. Verificar: **Table Editor** → `membership_plans`

### Opción B — Admin UI (plan suelto o corrección)

1. `npm run dev:staging` → `http://localhost:5190`
2. Login `admin.staging@zonacero.test` / `ZonaCero2026!`
3. `/admin/planes` → Crear / Editar / Desactivar

Usar SQL cuando son varios planes a la vez; UI para un ajuste puntual.

---

## 3. Validar

| # | Check | Cómo |
|---|--------|------|
| 1 | Admin ve catálogo correcto | `/admin/planes` |
| 2 | Socio ve planes activos | `/membresia` con `socio.staging@zonacero.test` |
| 3 | Plan restringido bloquea área | Socio con plan Plata → Explorar → Hyrox debe bloquear |
| 4 | Plan inactivo oculto | Desactivar plan → socio no lo ve |
| 5 | Cobro extiende membresía | `/admin/cobros` → registrar pago → vigencia actualizada |

Checklist completo: `docs/tecnico/qa-checklists/ZCAPP-16-membership-plans.md`

---

## 4. Ejemplo de prueba (simular respuesta de William)

**Matriz ficticia** (solo para practicar el flujo):

| Plan | Precio | Duración | Visitas | Áreas |
|------|--------|----------|---------|-------|
| Plan Gold | $120 | 90 días | Ilimitado | Todas |
| Plan Silver | $45 | 30 días | Ilimitado | Gimnasio, Musculación, Nutrición |
| Plan Plata | $30 | 30 días | Ilimitado | Solo Musculación |
| Pase 10 Visitas | $35 | 60 días | 10 | Gimnasio, Musculación, Áreas comunes |
| Dragon Fit Mensual | $50 | 30 días | Ilimitado | Dragon Fit, Gimnasio, Musculación |

SQL listo: **`app/supabase/planes-william-ejemplo.sql`**

```powershell
# Tras ejecutar el SQL en Supabase:
cd app
npm run dev:staging
# → http://localhost:5190/admin/planes
```

---

## 5. Cuando llegue la tabla real

1. Copiar `planes-william-ejemplo.sql` → `planes-zona-cero-prod.sql` (o staging definitivo)
2. Sustituir nombres, precios (`price_cents` = USD × 100), duraciones, zonas
3. Ejecutar en staging → validar con William
4. Actualizar `seed.sql` en repo para futuros provisiones
5. Comentario en Jira ZCAPP-16 con capturas + link checklist
