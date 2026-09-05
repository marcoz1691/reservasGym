# ReservasGym App (Intermedia)

App web del paquete **Intermedia ($4.500)**: reservas en todas las áreas, control de peso, panel admin y marca del gym. Listo para empaquetar con Capacitor (fase tiendas).

## Stack

React 19 · Vite · TypeScript strict · Tailwind v4 · React Router · Zustand · Vitest · Supabase (opcional) · date-fns · qrcode

## Cómo correr

```bash
cd app
npm install
npm run dev
```

Cuentas demo (solo `npm run dev`, contraseña `demo1234`):

- `socio@gym.local` — socio
- `staff@gym.local` — recepción
- `admin@gym.local` — admin

Sin `VITE_SUPABASE_*` en desarrollo usa `LocalRepository` (localStorage + seed).
En build de producción **exige** Supabase (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).

### Staging (QA con Supabase real)

```bash
cd app
copy .env.staging.example .env.staging   # Windows
# Editar .env.staging con credenciales del proyecto zona-cero-staging
npm run dev:staging
```

Usuarios staging (crear en Supabase Auth; ver `supabase/staging-users.sql`):

- `socio.staging@zonacero.test` — socio
- `staff.staging@zonacero.test` — recepción
- `admin.staging@zonacero.test` — admin

Guía completa: [`docs/tecnico/staging-setup.md`](../docs/tecnico/staging-setup.md)

## Scripts

| Script | Uso |
|---|---|
| `npm run dev` | Servidor local |
| `npm run dev:staging` | Local apuntando a Supabase staging (`.env.staging`) |
| `npm run build` | Build producción |
| `npm test` | Tests de dominio |
| `npm run preview` | Preview del build |
| `npm run cap:sync` | Build + sync Capacitor (iOS/Android) |
| `npm run cap:ios` | Abrir proyecto iOS en Xcode |
| `npm run cap:android` | Abrir proyecto Android en Android Studio |


## Estructura

```
src/
  app/        router, layouts, store
  ui/         design system (primitives)
  features/   auth, catalog, agenda, bookings, weight, admin
  domain/     modelos + reglas puras
  data/       LocalRepository + seed + schema Supabase
```

Schema SQL: `supabase/schema.sql`  
Checklist tiendas: `docs/store-checklist.md`  
Plan técnico: `../docs/tecnico/plan-intermedia.md`
