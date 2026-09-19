# ZCAPP-18 — Checklist «Listo para pruebas»

**Ticket Jira:** ZCAPP-18 · Pantalla Socio «Mi Plan» e Historial — WBS 1.2.3

**DoD:** plan visible, fecha fin, días restantes, historial de pagos, banner de vencimiento.

## Comando

```powershell
cd app && npm run dev:staging
```

**Socio:** `socio.staging@zonacero.test` / `ZonaCero2026!`
**Ruta:** `/membresia`

## Casos de prueba — resultado 2026-09-18

Suite: `app/src/test/qaZcapp18MiPlan.test.tsx` — **12 PASS**

```powershell
npm test -- --run src/test/qaZcapp18MiPlan.test.tsx
```

### Estados de la membresía en la tarjeta

- [x] **ZC18-01** Membresía activa muestra plan, «Fecha de vencimiento» y «20 días restantes»
- [x] **ZC18-02** Último día de vigencia se comunica como «Último día de acceso»
- [x] **ZC18-03** Período de gracia muestra el badge y la fecha límite para renovar
- [x] **ZC18-04** Membresía vencida muestra el aviso rojo y deja de marcar el plan como actual
- [x] **ZC18-05** Membresía cancelada se identifica como «Cancelada» aunque la fecha siga vigente
- [x] **ZC18-06** Plan con cupo de visitas muestra «6 de 10 pases»
- [x] **ZC18-07** Socio sin membresía ve el instructivo de activación y el historial vacío

### Historial de pagos

- [x] **ZC18-08** Lista los pagos del socio del más reciente al más antiguo
- [x] **ZC18-09** Muestra monto, método y estado (Aprobado / Pendiente / Rechazado) de cada comprobante
- [x] **ZC18-10** El socio no ve comprobantes de otros socios

### Banner de vencimiento

- [x] **ZC18-11** En gracia, el banner global avisa los días restantes para renovar
- [x] **ZC18-12** Con una membresía vencida antigua y otra vigente, banner y tarjeta coinciden — **CORREGIDO (ZC18-D1)**

## Defecto resuelto

### ZC18-D1 — El banner global contradecía la tarjeta cuando el socio tenía histórico

**Estado:** Corregido · `selectMyMembership` ahora prefiera `active`/`grace` (misma regla que `getMemberMembership`).

## Observaciones restantes (no bloquean)

| ID | Observación | Severidad | Estado |
|----|-------------|-----------|--------|
| ZC18-O1 | Banner sin membresía decía «Membresía vencida» | Baja | **Corregido** → «No tienes un plan activo…» |
| ZC18-O2 | Umbrales en UTC vs fechas en America/Guayaquil cerca de medianoche | Baja | **Corregido** → `daysRemaining` / días de gracia en calendario `America/Guayaquil` |
| ZC18-O3 | Barra de progreso fija `Date.now()` al montar | Informativa | **Corregido** → reloj vivo cada 60s en `MembershipCard` |

## Evidencia

- Salida de `npm test -- --run src/test/qaZcapp18MiPlan.test.tsx`
- Pendiente: screenshots de `/membresia` en staging para los estados activa, gracia y vencida
