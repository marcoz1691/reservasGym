# Flujos funcionales — Avanzada (cliente)

Versión legible para el dueño del gimnasio. Detalle técnico en [plan-avanzada.md](../../tecnico/plan-avanzada.md).

---

## ¿Qué gana el gym?

- Saber **quién tiene la membresía al día** y quién debe.
- Cobrar **en recepción** (efectivo, transferencia, tarjeta) y registrarlo en el sistema.
- Dejar que el socio **renueve solo desde el celular** con Mercado Pago.
- **Avisar** al socio antes de que venza (banner en la app).
- **Bloquear reservas nuevas** si la membresía está vencida (después de 3 días de gracia).

---

## Flujo 1 — El socio renueva desde el celular

1. Abre la app → **Mi plan**.
2. Ve su plan, cuánto cuesta y hasta qué fecha está activo.
3. Toca **Renovar ahora**.
4. Paga en Mercado Pago (tarjeta, débito, etc.).
5. Vuelve a la app: membresía extendida automáticamente.
6. Puede seguir reservando clases con normalidad.

**Si el pago falla:** la membresía no cambia; puede intentar de nuevo o pagar en recepción.

---

## Flujo 2 — Recepción cobra en efectivo

1. Staff entra al **Panel de cobros** (desde admin).
2. Busca al socio por nombre.
3. Elige el plan (mensual, trimestral…) y el método: efectivo, transferencia o tarjeta en mostrador.
4. Confirma el cobro.
5. La membresía del socio queda activa al instante.

---

## Flujo 3 — El admin configura los planes

1. Entra a **Planes** en el panel admin.
2. Crea o edita: nombre, precio, duración (días), visitas opcionales.
3. Los planes activos aparecen cuando el socio va a renovar.

---

## Flujo 4 — Avisos de vencimiento

- **7 días antes:** banner en la app: "Tu membresía vence pronto".
- **Ya venció:** 3 días de **gracia** — puede seguir reservando pero con aviso fuerte.
- **Después de la gracia:** no puede reservar clases nuevas hasta renovar.
- **En recepción:** lista de socios vencidos o en gracia para llamarlos.

---

## Flujo 5 — Reservas y membresía

- Membresía **al día** o en **gracia** → reserva normal.
- Membresía **vencida** → la app muestra un mensaje y lleva a Mi plan.
- Las reservas **ya hechas** antes de vencer **no se cancelan** solas.

---

## Flujo 6 — Check-in en clase

- Al hacer check-in con QR, el staff ve si la membresía está vigente, en gracia o vencida.
- El check-in de una reserva válida sigue funcionando.

---

## Roles

| Quién | Qué puede hacer |
|---|---|
| **Socio** | Ver Mi plan, pagar con Mercado Pago, reservar si está al día |
| **Staff** | Cobrar en recepción, ver vencidos |
| **Admin** | Todo lo anterior + crear planes + marca del gym |

**Una sola app.** Socio, recepción y admin usan el mismo instalable; cambian las pantallas según el usuario. No hay “app solo admin”.

**Base de datos:** en el gym real sí (Supabase/Postgres). En demos se puede usar datos locales sin DB.

---

---

## Lo que NO incluye Avanzada

- Facturas electrónicas del SRI.
- Venta de suplementos o productos online (paquete Completa).

---

## Mercado Pago — quién paga qué

- El gym abre su **cuenta Mercado Pago**.
- Las **comisiones** de cada pago las cobra Mercado Pago al gym.
- El software solo conecta la app con esa cuenta.
