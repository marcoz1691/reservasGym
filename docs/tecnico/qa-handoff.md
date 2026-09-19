# Kit de entrega QA — Zona Cero

Ambiente de pruebas **tipo producción** (no local) para validación profesional.

## URL fija

**https://zona-cero-qa.vercel.app**

Abrir en desktop o en iPhone/Android (Safari / Chrome). Opcional: «Añadir a pantalla de inicio».

## Cuentas

| Rol | Email | Contraseña |
|-----|-------|------------|
| Socio | `socio.staging@zonacero.test` | `ZonaCero2026!` |
| Recepción (staff) | `staff.staging@zonacero.test` | `ZonaCero2026!` |
| Administrador | `admin.staging@zonacero.test` | `ZonaCero2026!` |

Cerrar sesión entre roles.

## Backend

Supabase proyecto `zona-cero` (staging). Misma BD que `npm run dev:staging` local.

## Evidencias (Jira)

Al validar un ticket, comentar:

- URL: `https://zona-cero-qa.vercel.app`
- Usuario usado
- Checklist PASS/FAIL
- Screenshot o video corto si aplica

Checklists: `docs/tecnico/qa-checklists/`

## Fuera de alcance día 1

- ~~Cobros Mercado Pago sandbox~~ — **código listo**; falta Access Token TEST en secrets Supabase (ver `docs/tecnico/mercadopago-setup.md`)
- APK / TestFlight nativo (fase 2)

## Pago en línea (Mi Plan)

1. Socio → `/membresia` → **Pagar en línea** en un plan
2. Redirect a Mercado Pago Checkout Pro
3. Webhook extiende membresía al aprobar

Webhook: `https://kqhmclbexnnsbzbgerbx.supabase.co/functions/v1/mp-webhook`

## Auth (mantenimiento)

Dashboard Supabase → Authentication → URL Configuration:

- Site URL: `https://zona-cero-qa.vercel.app`
- Redirect URLs: `https://zona-cero-qa.vercel.app/**`, `http://localhost:5190/**`
