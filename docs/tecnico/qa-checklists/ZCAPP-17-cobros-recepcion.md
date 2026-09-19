# ZCAPP-17 — Checklist «Listo para pruebas»

**Ticket Jira:** ZCAPP-17 · Panel de Cobros Recepción (Datafast POS) — WBS 1.2.2

**DoD:** buscar socio, registrar cobro manual, sync offline-first.

**Dependencia:** ZCAPP-16 (catálogo de planes) operativo.

## Comando

```powershell
cd app && npm run dev:staging
```

**Staff:** `staff.staging@zonacero.test` / `ZonaCero2026!`
**Admin:** `admin.staging@zonacero.test` / `ZonaCero2026!`
**Ruta:** `/admin/cobros`

## Casos de prueba — resultado 2026-09-18

Suite: `app/src/test/qaZcapp17Cobros.test.tsx` — **16/16 PASS**

```powershell
npm test -- --run src/test/qaZcapp17Cobros.test.tsx
```

### Registro de cobro por método de pago

- [x] **ZC17-01** Efectivo: staff cobra y activa membresía de un socio sin plan — vigencia 30 días
- [x] **ZC17-02** Transferencia: el cobro guarda la referencia bancaria
- [x] **ZC17-03** Datafast POS: el cobro guarda el voucher y queda aprobado
- [x] **ZC17-04** Cobro sin referencia guarda `null`, no cadena vacía

### Extensión de membresía al cobrar

- [x] **ZC17-05** Socio vigente: la renovación acumula 30 días desde la fecha fin, y la gracia queda en +3 días
- [x] **ZC17-06** Socio en gracia: la renovación reinicia la vigencia desde la fecha de pago (no apila sobre la fecha vencida)
- [x] **ZC17-07** Plan con cupo: renovar a un socio vigente acumula los pases restantes (4 + 10 = 14)

### Permisos y validaciones de backend

- [x] **ZC17-08** Un socio no puede registrar cobros → «Sin permiso»
- [x] **ZC17-09** Cobro contra un plan inexistente es rechazado → «Plan no encontrado»
- [x] **ZC17-10** Offline-first: el cobro y la membresía sobreviven a recargar la aplicación (`localStorage`)

### Panel de recepción (UI)

- [x] **ZC17-11** Staff cobra en efectivo y obtiene el recibo con monto, medio de cobro y referencia
- [x] **ZC17-12** Renovación rápida desde «Socios por Vencer» precarga el POS y completa el cobro
- [x] **ZC17-13** La búsqueda de socio por correo ignora mayúsculas y minúsculas
- [x] **ZC17-14** No se puede cobrar sin socio ni sin plan (botón deshabilitado); monto en cero deja el campo inválido y no registra
- [x] **ZC17-15** El historial refleja el cobro recién registrado con su método y monto
- [x] **ZC17-16** Elegir un socio con plan previo precarga ese plan y su precio

## Observaciones (no bloquean el DoD)

| ID | Observación | Severidad |
|----|-------------|-----------|
| ZC17-O1 | La tarjeta lateral se titula **«Caja Hoy»** pero `metrics` suma **todos** los pagos históricos, sin filtro por fecha (`CobrosPage.tsx:245-264`, label en L901). Recepción podría cuadrar caja con un número equivocado. | Media |
| ZC17-O2 | `registerManualPayment` acepta cualquier `amountCents > 0`, sin validar contra `plan.priceCents`. Es útil para descuentos, pero no queda registro de que el monto difiere del tarifario. | Baja |
| ZC17-O3 | `listMembers()` (`localRepository.ts:822`) no verifica rol; el bloqueo a socios está solo en la UI de `CobrosPage`. En Supabase depende de RLS. | Media |

## Evidencia

- Salida de `npm test -- --run src/test/qaZcapp17Cobros.test.tsx` — 16/16 PASS
- Regresión completa `npm test` — 36 archivos, 267 PASS + 1 fallo esperado (defecto ZC18-D1 de ZCAPP-18)
- Pendiente: screenshots del recibo en staging con Supabase para los tres métodos
