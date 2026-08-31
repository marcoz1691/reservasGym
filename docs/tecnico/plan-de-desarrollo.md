# Plan de desarrollo — ReservasGym

> **Enfoque actual: paquete Avanzada ($6.500).**  
> Plan Intermedia (base): [plan-intermedia.md](./plan-intermedia.md).  
> Plan Avanzada (membresías + Mercado Pago): [plan-avanzada.md](./plan-avanzada.md).

Documento de referencia técnica. Define el stack, la arquitectura y el modelo. La aplicación vive en `/app`.

---

## 1. Stack

Aplicación web TypeScript con estética tipo Human Interface Guidelines de Apple.

| Capa | Elección |
|---|---|
| Lenguaje | TypeScript `strict` |
| Framework | React 19 |
| Build | Vite 7 |
| Estilos | Tailwind CSS v4 |
| Rutas | React Router v7 |
| Estado | Zustand |
| Backend | Supabase (Auth + Postgres + RLS) |
| Nativo | Capacitor (iOS / Android) |
| Pruebas | Vitest + Testing Library |
| QR | `qrcode` |
| Fechas | date-fns locale `es` |

---

## 2. Arquitectura

```
app/src/
  app/         router, providers, layouts
  ui/          design system
  features/    auth, catalog, agenda, bookings, weight, memberships, admin
  domain/      modelos y reglas puras
  data/        interfaces + LocalRepository + SupabaseRepository
  lib/         utilidades
```

La vista no contiene lógica de negocio. Los hooks de `features/*` orquestan casos de uso de `domain` sobre repositorios.

---

## 3. Paquetes comerciales vs código

| Paquete | Qué se construye ahora |
|---|---|
| Básica | Reservas web + admin + marca |
| Intermedia | Básica + peso + Capacitor / tiendas |
| **Avanzada** | Intermedia + membresías / Mercado Pago / panel cobros ← **activo** |
| Completa | + facturación / tienda productos (posterior) |

---

## 4. Fuera de alcance (Avanzada)

Facturación electrónica SRI, e-commerce de productos, multi-sede, wallet prepago.

---

## 5. Cómo correr

```bash
cd app
npm install
npm run dev
```

Para demos sin Supabase, la app usa `LocalRepository` automáticamente.  
Con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` usa el backend real.

Ver [plan-avanzada.md](./plan-avanzada.md) para fases, modelo de datos, Mercado Pago y checklist de entrega.  
Prototipo: [../prototipo/avanzada/](../prototipo/avanzada/).
