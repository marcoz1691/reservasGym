# Wireframes — Admin (Planes y Cobros)

Referencia: GYM-One `admin/shop/tickets/`, `admin/boss/sell/`.

---

## 1. Dashboard admin — links nuevos

```
┌──────────────────────────────────────────────────┐
│ Panel admin                                      │
├──────────┬───────────────────────────────────────┤
│ Dashboard│  Ocupación hoy · sesiones activas     │
│ Cobros   │                                       │
│ Planes   │  [ Panel de cobros ]  [ Planes ]      │
│ Marca    │                                       │
│ Check-in │                                       │
└──────────┴───────────────────────────────────────┘
```

Staff ve **Cobros**; solo admin ve **Planes**.

---

## 2. Planes CRUD (`/admin/planes`)

```
┌──────────────────────────────────────────────────┐
│ Planes de membresía              [ + Nuevo plan ]│
├──────────────────────────────────────────────────┤
│ Nombre          Precio   Días   Visitas  Activo  │
│ Mensual         $45      30     —        ✓  [✎] │
│ Trimestral      $120     90     —        ✓  [✎] │
│ 10 visitas      $35      60     10       ✓  [✎] │
└──────────────────────────────────────────────────┘
```

### Modal nuevo/editar plan

```
┌─────────────────────────┐
│ Plan de membresía       │
│ Nombre: [____________]  │
│ Precio USD: [____]      │
│ Duración (días): [__]   │
│ Visitas (vacío=∞): [__] │
│ [✓] Activo              │
│ [ Guardar ] [ Cancelar ]│
└─────────────────────────┘
```

---

## 3. Panel de cobros (`/admin/cobros`)

Tabs: **Cobrar** | **Vencidos**

### Tab Cobrar

```
┌──────────────────────────────────────────────────┐
│ Panel de cobros                                  │
│ Buscar socio: [ nombre o email________ ] [🔍]    │
├──────────────────────────────────────────────────┤
│ María López · maria@email.com                    │
│ Plan actual: Mensual · vence 12 sep · [Gracia]   │
├──────────────────────────────────────────────────┤
│ Cobrar plan:  [ Mensual $45        ▼ ]           │
│ Método:       ( ) Efectivo ( ) Transferencia     │
│               ( ) Tarjeta POS                    │
│ Notas:        [________________________]         │
│               [ Confirmar cobro ]                │
├──────────────────────────────────────────────────┤
│ Últimos pagos de María                           │
│ 15 ago  $45  Mercado Pago  Aprobado              │
└──────────────────────────────────────────────────┘
```

Tras confirmar: toast "Cobro registrado — vigente hasta [fecha]".

---

## 4. Tab Vencidos

```
┌──────────────────────────────────────────────────┐
│ Socios por vencer / vencidos                     │
│ Filtro: [ Todos ▼ ]  Orden: urgencia             │
├──────────────────────────────────────────────────┤
│ Juan P.    Gracia (1 día)    Mensual   [Cobrar]│
│ Ana R.     Vencida           Mensual   [Cobrar]│
│ Luis M.    Vence en 3 días   Trimestral [Cobrar]│
└──────────────────────────────────────────────────┘
```

Tap **Cobrar** pre-llena socio en tab Cobrar.

---

## 5. Resumen cobros del día (v1 simple)

```
┌─────────────────────────────────────┐
│ Hoy                                 │
│ Efectivo: $180  ·  MP: $90  ·  $270 │
└─────────────────────────────────────┘
```

Agregado desde `payments` approved hoy (no tabla `revenu_stats` separada).

---

## 6. Check-in con chip membresía

En pantalla check-in existente, añadir:

```
Reserva: CrossFit 18:00 — Juan P.
Membresía: [Vigente] / [Gracia] / [Vencida]
[ Confirmar check-in ]
```

Informativo en v1; no bloquea check-in de reserva válida.

---

## Permisos

| Pantalla | staff | admin |
|---|---|---|
| Cobros | ✓ | ✓ |
| Planes CRUD | — | ✓ |
| Vencidos | ✓ | ✓ |
