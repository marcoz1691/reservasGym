# Plan técnico — Avanzada ($6.500)

Documento de implementación del paquete comercial **Avanzada**: todo lo de Intermedia más **membresías, pagos, renovaciones, avisos de vencimiento y panel de cobros**. Con este cliente: cobro en recepción (Datafast físico / efectivo / transferencia); botón online = fase opcional si activan Dataweb.

Referencia comercial: [plan-comercial.md](../comercial/plan-comercial.md).  
Base Intermedia: [plan-intermedia.md](./plan-intermedia.md).  
Pasarelas Ecuador: [pasarelas-ecuador.md](./pasarelas-ecuador.md).  
Referencia de dominio: [GYM-One](../../GYM-One/) (conceptos, no stack PHP).

---

## 0. ¿Cumple el Avanzada ($6.500) que aceptó el cliente?

**Sí, si el alcance escrito es el de la oferta comercial** (membresías + cobros + renovaciones + avisos + panel), **no** “el socio paga solo desde el celular con checkout online”.

| Promesa comercial Avanzada | ¿v1 con Datafast físico lo cubre? |
|---|---|
| Todo Intermedia (app, peso, reservas) | Sí |
| Seguimiento de membresías (planes, vigencias, acceso) | Sí |
| Pagos y renovaciones | **Sí vía recepción** (panel cobros + registro tarjeta POS/efectivo/transferencia) |
| Avisos de vencimiento | Sí (in-app) |
| Panel de cobros del gym | Sí |
| Socio paga **online en la app** (checkout) | **No en v1** — el gym no tiene Datafast online |
| Facturación SRI / venta productos | No (eso es Completa $9.500) |

El plan comercial ya contempla: *“pasarela online según lo que el gym ya use… **o cobro en recepción**”* ([plan-comercial.md](../comercial/plan-comercial.md) § Avanzada).

**Acción comercial recomendada:** confirmar por escrito al cliente (la cotización decía “Pagos y renovaciones” / “cobros incluidos” — puede malinterpretarse como checkout en el celular):

> En Avanzada “pagos y renovaciones” = panel de cobros del gym + registrar renovaciones + membresías al día + avisos. El cobro lo hacen ustedes como hoy (datáfono Datafast / efectivo). El socio ve su plan en la app. Si más adelante activan Datafast online (Dataweb), conectamos el botón en el celular **dentro de Avanzada** (no es Completa). Completa es facturación SRI y venta de productos online.

Si el cliente **exigió explícitamente** “pagar membresía desde el celular” al aceptar, entonces v1 sin online **no** cierra esa expectativa: hay que activar Dataweb o ajustar precio/alcance.

## 1. Alcance

### Incluye

- Todo el alcance Intermedia (reservas, peso, admin marca, Capacitor).
- **Planes de membresía** (catálogo admin): nombre, precio USD, duración, cupo visitas opcional.
- **Membresía activa por socio**: vigencia, estado, visitas restantes.
- **Panel de cobros** (staff/admin): buscar socio, cobro manual (efectivo / transferencia / tarjeta POS), lista de vencidos.
- **Mi plan** (socio): estado, días restantes, historial; CTA **Renueva en recepción** (v1; online Datafast después si activan Dataweb).
- **Avisos de vencimiento** in-app (banner si vence en ≤7 días; urgente en gracia).
- **Gate de reservas**: socio `expired` no puede crear reservas nuevas (gracia 3 días post-vencimiento).
- Cobro recepción con método **tarjeta POS** = datáfono Datafast (registro en app, cobro físico fuera).

### Fuera de alcance (Completa / upsells)

- Facturación electrónica SRI.
- Tienda / links de pago para productos.
- Wallet prepago tipo GYM-One `profile_balance`.
- Email SMTP de recordatorios (v2; v1 solo in-app).
- Multi-sede, torniquete físico.

---

## 2. Arquitectura

### 2.0 Decisiones clave (FAQ)

#### ¿App separada para admin/recepción o la misma?

**Una sola app.** Mismos build Capacitor / web. Al iniciar sesión el **rol** decide qué ve:

| Rol | UI principal | Dispositivo típico |
|---|---|---|
| `member` (socio) | Tabs: Inicio, Explorar, Reservas, Mi plan, Peso | Celular |
| `staff` (recepción) | Admin: cobros, check-in, sesiones, vencidos | Tablet / PC / celular |
| `admin` | Todo staff + planes + marca | PC / tablet |

No se construye una segunda app “solo admin”. Ahorra costo, un solo código y una sola publicación en tiendas. El staff abre la misma app con su usuario.

#### ¿Se debe usar base de datos?

**Sí, en producción.** Supabase = **Postgres** + Auth + RLS.

| Entorno | Almacenamiento |
|---|---|
| Demo / desarrollo sin credenciales | `LocalRepository` (memoria / localStorage) — sin DB real |
| Staging / pruebas con backend | Proyecto Supabase **staging** |
| Producción / cliente real | Proyecto Supabase **prod** |

Sin base de datos no hay multi-dispositivo, historial de pagos, ni webhooks de la pasarela confiables. La DB es obligatoria para entregar Avanzada a un gym real.

#### ¿Qué pasarela de pago usamos?

**Cliente actual: Datafast físico (datáfono), sin comercio online aún.**

| Canal | v1 Avanzada | Notas |
|---|---|---|
| Efectivo / transferencia | Sí — panel `/admin/cobros` | Staff registra |
| Tarjeta en datáfono Datafast | Sí — método `card_pos` en cobro manual | El dinero entra por el datáfono; la app solo registra el cobro y extiende la membresía |
| Botón online en la app | **No en v1** (no tienen Dataweb) | CTA socio: “Renueva en recepción” / “Paga en el gym” |
| Datafast online (Dataweb) | Fase opcional posterior | Cuando el gym active e-commerce Datafast con el banco |

**Arquitectura:**
1. Cobro manual siempre (incluye `card_pos` = Datafast físico).
2. `PaymentProvider` preparado para `datafast` online más adelante.
3. No integrar Mercado Pago / Kushki / PagoPlux salvo que el cliente lo pida después.

Guía general: [pasarelas-ecuador.md](./pasarelas-ecuador.md).

#### ¿Ambiente de pruebas (dev) y producción?

**Sí. Tres capas, no cuatro.**

| Capa | Qué es | ¿Hace falta QA aparte? |
|---|---|---|
| **Local** | Laptop del dev (`npm run dev` + LocalRepository o Supabase staging) | — |
| **Staging (= QA)** | Un solo proyecto Supabase de pruebas + build de test | **No hace falta un 4.º ambiente “QA”** |
| **Producción** | Gym real | — |

**Por qué no un QA separado (dev + QA + staging + prod):**
- Para un gym / paquete Avanzada ($6.500) es costo y mantenimiento de más (otro Supabase, otra pasarela test, más secrets).
- Staging **es** el ambiente de QA: ahí pruebas tú, el cliente y la pasarela en modo test.
- Local cubre el día a día del desarrollo.

**Cuándo sí valdría un QA aparte:** varios clientes en la misma plataforma, equipo de testers dedicado, o compliance estricto. Hoy no aplica.

| | **Local** | **Staging / QA** | **Producción** |
|---|---|---|---|
| Uso | Desarrollar features | Probar, demos, sandbox pasarela | Gym real |
| Backend | LocalRepository o Supabase staging | Proyecto Supabase **staging** | Proyecto Supabase **prod** |
| Pasarela | Mock / test | Credenciales **Test** | Credenciales **Prod** |
| Quién entra | Dev | Dev + cliente (pruebas) | Socios + staff |

**Flujo:** local → staging (QA + demo cliente) → prod tras checklist.

#### Plan Supabase (Free vs Pro)

| Fase | Proyecto | Plan |
|------|----------|------|
| Sprint 1–6 | `zona-cero` (staging) | **Free** |
| Go-Live (Sprint 7) | `zona-cero-prod` | **Pro** (~$25/mes) |

Detalle y triggers de upgrade: [cronograma-desarrollo-avanzada.md §8](./cronograma-desarrollo-avanzada.md#8-decisión-de-arquitectura--supabase-plan-free-vs-pro).

**Nota:** el badge `main PRODUCTION` en Supabase es la rama principal de Postgres, no el ambiente del gym.

### 2.1 Capas

```
Capacitor (iOS/Android) → React SPA (Vite)
  → features/* (UI)
  → RepositoryProvider → GymRepository
  → domain/rules/* (puro, testeado)
  → LocalRepository | SupabaseRepository
  → Postgres + RLS + Auth
  → Edge Functions (pasarela de pago: Datafast / Kushki / PagoPlux / …)
```

### 2.2 Principios

| Principio | Implementación |
|---|---|
| Un repositorio | `GymRepository` con Local (demo) y Supabase (prod) |
| Pagos en servidor | `MP_ACCESS_TOKEN` solo en Edge Functions |
| Idempotencia | Webhook deduplica por `mp_payment_id` |
| Extensión | Avanzada añade tablas/métodos; Intermedia intacta |

### 2.3 Estructura nueva

```
app/src/features/memberships/   Mi plan, banner, historial
app/src/features/admin/         PlansPage, CobrosPage
app/src/domain/rules/           membership.ts, payment.ts
app/supabase/functions/         create-mp-preference, mp-webhook
```

### 2.4 Modelo de datos

**membership_plans** — catálogo (equiv. GYM-One `tickets`)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| name | text | Ej. "Mensual ilimitado" |
| price_cents | int | USD centavos |
| duration_days | int | 30, 90, 365… |
| visit_quota | int nullable | null = ilimitado |
| active | bool | Inactivo no se ofrece al socio |

**memberships** — vigencia activa (equiv. `current_tickets`)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK profiles | |
| plan_id | uuid FK | |
| status | text | active \| grace \| expired \| cancelled |
| starts_at | timestamptz | |
| ends_at | timestamptz | |
| visits_left | int nullable | |
| grace_ends_at | timestamptz nullable | ends_at + 3 días |

**payments** — ledger (equiv. `invoices` + MP)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| plan_id | uuid FK | |
| membership_id | uuid FK nullable | |
| amount_cents | int | |
| status | text | pending \| approved \| rejected \| refunded |
| provider | text | manual \| mercadopago |
| manual_method | text nullable | cash \| transfer \| card_pos |
| mp_preference_id | text nullable | |
| mp_payment_id | text nullable UNIQUE | idempotencia webhook |
| approved_at | timestamptz nullable | |
| created_at | timestamptz | |

### 2.5 RLS (resumen)

- **member**: SELECT propia membresía y pagos; INSERT payment pending solo vía Edge (no directo).
- **staff/admin**: SELECT/INSERT/UPDATE memberships y payments de todos; CRUD planes (admin).
- Edge Functions usan service role para webhook.

### 2.6 Pasarela de pago (online)

Ver [pasarelas-ecuador.md](./pasarelas-ecuador.md) — qué pedirle al cliente y comparativa.

Setup específico Mercado Pago (solo si eligen esa): [mercadopago-setup.md](./mercadopago-setup.md).

Flujo genérico: socio → Edge `create-payment` → checkout de la pasarela → webhook → extiende membresía.

---

## 3. Flujos funcionales

Ver detalle en [../prototipo/avanzada/flujos-funcionales.md](../prototipo/avanzada/flujos-funcionales.md).

| ID | Flujo | Actor |
|---|---|---|
| A | Renovar online (pasarela del gym) o pagar en recepción | Socio |
| B | Cobro manual recepción | Staff |
| C | CRUD planes | Admin |
| D | Avisos vencimiento | Sistema + socio |
| E | Gate reservas | Sistema |
| F | Check-in + chip membresía | Staff |

### Estados de membresía

```
active → (ends_at) → grace (3 días) → expired
active/grace + pago → active (extendida)
admin → cancelled
```

| Estado | Reservas nuevas | Banner |
|---|---|---|
| active | Sí | No |
| grace | Sí | Urgente |
| expired | No | Sí + modal |
| cancelled | No | — |

### Reglas de dominio (Vitest)

- `isMembershipValid(membership, date)` — active o grace
- `canBook(membership, date)` — false si expired/cancelled
- `extendMembership(current, plan, paidAt)` — suma días desde max(endsAt, paidAt)
- `applyApprovedPayment(payment, membership, plan)` — idempotente

---

## 4. Pantallas y rutas

| Ruta | Pantalla | Rol |
|---|---|---|
| `/membresia` | Mi plan, historial, Renovar | member |
| `/admin/planes` | CRUD planes | admin |
| `/admin/cobros` | Buscar, cobrar, vencidos | staff, admin |
| `/admin` | Links a planes y cobros | staff, admin |

Nav socio: tab **Mi plan**. Nav admin: sidebar **Planes**, **Cobros**.

---

## 5. Diseño UI

Design system: [../design-systems/reservasgym-avanzada.md](../design-systems/reservasgym-avanzada.md) (UI UX Pro Max).

Regla: extender `app/src/ui/primitives.tsx`; respetar `--color-acc` de `GymSettings` como override del accent del gym.

Wireframes: [../prototipo/avanzada/](../prototipo/avanzada/).

---

## 6. Fases de construcción

| Fase | Entregable |
|---|---|
| 0 | Docs + wireframes + design system |
| B | Domain + tests |
| C | Schema + repos + seed |
| D | UI manual (Mi plan, admin cobros) |
| E | Edge MP + webhook |
| F | Gate + banners |
| G | Checklist entrega + capacitación |

Estimación: 4–6 semanas sobre Intermedia ya construida (1 dev).

---

## 7. Referencia GYM-One

| GYM-One | ReservasGym |
|---|---|
| `tickets` | `membership_plans` |
| `current_tickets` | `memberships` |
| `invoices` | `payments` |
| Admin sell | `/admin/cobros` + MP |
| Member dashboard | `/membresia` |

Archivos clave: `GYM-One/assets/SQL/Init.sql`, `admin/boss/sell/payment/`, `dashboard/index.php`, `crontab/send_reminders.php`.

---

## 8. Criterios de aceptación

- [ ] Socio ve plan y renueva online (pasarela del gym) o vía cobro en recepción.
- [ ] Staff cobra efectivo y membresía se extiende al instante.
- [ ] Socio expired no reserva; ve CTA a Mi plan.
- [ ] Admin CRUD planes sin código.
- [ ] Demo LocalRepository funciona sin MP.
- [ ] Documentación y wireframes entregados al cliente.
