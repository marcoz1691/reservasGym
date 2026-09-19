# ZCAPP-19 — Checklist «Listo para pruebas»

**Ticket Jira:** ZCAPP-19 · Gate de Reservas (Vencimiento + Gracia 3d) — WBS 1.2.4

**DoD:** socio expired bloqueado para nuevas reservas; reservas previas válidas.

## Comando

```powershell
cd app && npm run dev:staging
```

**Socio:** `socio.staging@zonacero.test` / `ZonaCero2026!`
**Rutas:** `/agenda`, `/explorar`, `/mis-reservas`

## Interpretación validada de la regla

«Vencido» significa **después del período de gracia**. Durante los 3 días de gracia el
socio **sí** puede crear reservas nuevas: así está implementado en `canBookMembership`
(`membership.ts:49-95`) y así lo anuncia el banner («…antes de que se bloqueen tus
reservas»). Si negocio espera bloqueo desde `endsAt`, es un cambio de alcance, no un
defecto.

## Casos de prueba — resultado 2026-09-18

Suite: `app/src/test/qaZcapp19GateReservas.test.tsx` — **13/13 PASS**

```powershell
npm test -- --run src/test/qaZcapp19GateReservas.test.tsx
```

### Regla de negocio: bordes de vigencia y gracia

- [x] **ZC19-01** La gracia configurada es de 3 días (`GRACE_PERIOD_DAYS`)
- [x] **ZC19-02** Socio vigente puede reservar
- [x] **ZC19-03** En el instante exacto de vencimiento todavía puede reservar (`active`)
- [x] **ZC19-04** Durante los días 1, 2 y 3 de gracia sigue pudiendo reservar
- [x] **ZC19-05** Al terminar la gracia queda bloqueado con «Membresía vencida. Por favor renueva tu plan.»
- [x] **ZC19-06** Sin membresía no puede reservar → «No cuenta con una membresía activa.»
- [x] **ZC19-07** Membresía cancelada bloquea aunque la fecha siga vigente
- [x] **ZC19-08** Sin visitas disponibles bloquea incluso durante la gracia

### Gate en la agenda del socio

- [x] **ZC19-09** Agenda bloquea al socio vencido, abre el modal de gate y no llama a `createBooking`
- [x] **ZC19-10** Agenda bloquea al socio sin membresía
- [x] **ZC19-11** Agenda permite reservar durante el período de gracia, sin modal

### Reservas previas al vencimiento

- [x] **ZC19-12** Una reserva creada estando vigente sigue `confirmed` tras vencer la membresía
- [x] **ZC19-13** El socio vencido conserva el código de check-in de su reserva previa

## Observaciones (no bloquean el DoD)

| ID | Observación | Severidad |
|----|-------------|-----------|
| ZC19-O1 | El gate vive solo en la UI. `localRepository.createBooking` (L507) y `supabaseRepository.createBooking` (L827) no revalidan la membresía, así que una llamada directa a la API crearía la reserva. En Supabase la protección tendría que venir de RLS. Conviene confirmarlo antes de exponer la API. | Media |
| ZC19-O2 | El modal muestra el mismo texto para «sin membresía» y «membresía vencida» (`BookingGateModal.tsx:38`); un socio nuevo lee que su plan «está vencido». | Baja |
| ZC19-O3 | `StaffBookingModal` exige el checkbox de autorización también cuando el socio está en gracia, aunque la regla sí le permite reservar. | Baja |

## Evidencia

- Salida de `npm test -- --run src/test/qaZcapp19GateReservas.test.tsx` — 13/13 PASS
- Cobertura previa vigente: `membership.test.ts`, `BookingGate.test.tsx`, `ExpiryBanner.test.tsx`
- Pendiente: screenshot del modal de gate en staging con socio vencido
