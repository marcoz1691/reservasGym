# ReservasGym

App de reservas, aforo, check-in QR y control de peso para gimnasios (paquete **Intermedia $4.500**), más el material comercial para venderla en Ecuador.

---

## Estado del repositorio

| Área | Estado |
|---|---|
| Material comercial | Listo (`docs/comercial/`) |
| Plan técnico Intermedia | Listo (`docs/tecnico/plan-intermedia.md`) |
| App web demo (`app/`) | **Usable** — LocalRepository + seed |
| Capacitor Android | Proyecto nativo en `app/android/` |
| Capacitor iOS | Añadir en macOS (`npx cap add ios`) |
| Supabase producción | Schema en `app/supabase/`; activar con env |

---

## Arrancar la app

```bash
cd app
npm install
npm run dev
```

Demo (cualquier contraseña): `socio@gym.local` · `staff@gym.local` · `admin@gym.local`

```bash
npm run test
npm run build
```

### Tiendas (Capacitor)

```bash
cd app
npm run cap:sync          # build + sync nativo
npm run cap:android       # abre Android Studio
# en macOS:
npx cap add ios && npm run cap:ios
```

Checklist de publicación: [`app/docs/store-checklist.md`](app/docs/store-checklist.md).

---

## Estructura

```
app/                       App Vite + React 19 + TS + Tailwind v4
  src/domain/              Modelos y reglas (aforo, waitlist, peso…)
  src/data/                LocalRepository + seed Intermedia
  src/features/            Auth, catálogo, agenda, reservas, peso, admin
  android/                 Proyecto Capacitor Android
  supabase/                Schema SQL para producción
  docs/store-checklist.md  Publicación App Store / Play
docs/comercial/            Plan de ventas y presentación
docs/tecnico/              Plan Intermedia + visión técnica
```

---

## Alcance Intermedia (incluido)

- Reservas en las 8 áreas (gimnasio, fisio, nutrición, bailoterapia, comunes, Hyrox, musculación, CrossFit)
- Agenda, aforo, lista de espera, check-in QR, panel admin, marca
- CRUD control de peso + historial
- Empaquetado para App Store / Google Play (Capacitor)

**Fuera de alcance:** pagos/membresías, pasarela, facturación SRI, tienda de productos.

---

## Material comercial

Ver [`docs/comercial/plan-comercial.md`](docs/comercial/plan-comercial.md) y la presentación en `docs/comercial/presentacion/`.
