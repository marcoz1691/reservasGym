# Wireframes — Socio (Mi plan)

Referencia visual inspirada en GYM-One `dashboard/index.php`, adaptada a ReservasGym (dark + accent del gym).

---

## 1. Mi plan — membresía activa

```
┌─────────────────────────────────────┐
│ ←  Mi plan                          │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │  MENSUAL ILIMITADO      [Activo]│ │
│ │  $45.00 / mes                   │ │
│ │                                 │ │
│ │  Válido hasta: 15 sep 2026      │ │
│ │  ████████████░░░░  12 días      │ │
│ │                                 │ │
│ │  [    Renovar ahora    ]        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Historial de pagos                  │
│ ┌─────────────────────────────────┐ │
│ │ 15 ago 2026  $45  Mercado Pago ✓│ │
│ │ 15 jul 2026  $45  Efectivo    ✓│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
     [Inicio][Explorar][Reservas][Plan*]
```

**Componentes:** `PageHeader`, `MembershipCard`, `Badge` verde, `RenewButton`, `PaymentRow` list.

---

## 2. Banner vencimiento (global)

```
┌─────────────────────────────────────┐
│ ⚠ Tu membresía vence en 5 días.     │
│    Renovar →                    [×] │
└─────────────────────────────────────┘
```

Sticky bajo header. Tap → `/membresia`. No dismissible si `grace`.

---

## 3. Mi plan — en gracia

```
│ ┌─────────────────────────────────┐ │
│ │  MENSUAL ILIMITADO    [Gracia]  │ │
│ │  Venció el 10 sep — 2 días      │ │
│ │  de gracia restantes            │ │
│ │  [    Renovar urgente    ]      │ │
│ └─────────────────────────────────┘ │
```

Badge ámbar. Copy urgente.

---

## 4. Mi plan — vencida

```
│ ┌─────────────────────────────────┐ │
│ │  MENSUAL ILIMITADO   [Vencida]  │ │
│ │  Renueva para reservar clases   │ │
│ │  [    Renovar ahora    ]        │ │
│ │  o paga en recepción del gym    │ │
│ └─────────────────────────────────┘ │
```

Badge rojo. Sin barra de progreso.

---

## 5. Modal gate reservas (Explorar/Agenda)

```
        ┌───────────────────────┐
        │  Membresía vencida    │
        │                       │
        │  Renueva tu plan para │
        │  reservar clases.     │
        │                       │
        │  [ Ir a Mi plan ]     │
        │  [ Cancelar ]         │
        └───────────────────────┘
```

Bloquea acción reservar; no navega away sin elección.

---

## 6. Renovar — loading → Mercado Pago

```
│  Preparando pago...                 │
│  [ spinner ]                        │
│  Serás redirigido a Mercado Pago    │
```

Luego browser in-app / system browser con Checkout Pro MP.

---

## 7. Éxito tras pago

```
│ ✓ Membresía renovada                │
│ Válida hasta: 15 oct 2026           │
│ [ Volver al inicio ]                │
```

Query `?paid=1` en return URL. Confetti opcional (reduced-motion off).

---

## 8. Sin Mercado Pago configurado (demo)

```
│  Renovar online no disponible.      │
│  Acércate a recepción para pagar. │
```

CTA MP deshabilitado; demo LocalRepository sigue usable.

---

## Navegación

- Tab bar móvil: nuevo ítem **Mi plan** (`/membresia`), icono `CreditCard` Lucide.
- Desktop sidebar: mismo ítem bajo sección socio.
