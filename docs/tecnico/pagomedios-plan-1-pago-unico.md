# Pagomedios — Plan 1: pago en línea único

> Integración con Pagomedios (Abitmedia, API v2). Documento de alcance: qué hace la app, cómo es el flujo y qué **no** incluye.

## Contexto común
- API Pagomedios v2 (Abitmedia): `https://api.abitmedia.cloud/pagomedios/v2`, autenticada con un token Bearer.
- Los números de tarjeta de prueba nunca entran al repo ni a las pruebas; solo se escriben en el formulario de Pagomedios.
- Regla del sandbox: se **rechazan** los montos $2, $3, $4, $5, $50, $999 y $1000. Los flujos aprobados usan otro precio (por ejemplo, $45).
- El formulario de tarjeta **es de Pagomedios** (seguro, PCI, con 3-D Secure). La app nunca ve ni guarda la tarjeta, y no se embebe en un iframe porque 3-D Secure y algunos bancos lo bloquean.


## Objetivo
El socio paga su plan con tarjeta desde la app y la membresía se activa sola. El administrador ve esos pagos en "Cobros".

## Flujo
1. **Mi Plan / vitrina de planes → "Pagar en línea".** Debajo del botón dice "Pago único con tarjeta · sin cobros recurrentes".
2. **`/membresia/pago?planId=…`**: resumen del plan y total con IVA. El socio completa:
   - tipo y número de identificación (cédula, RUC, pasaporte o exterior);
   - teléfono;
   - dirección, prellenada con la de su ficha.

   Pagomedios exige estos datos para cobrar.
3. **"Pagar $X en Pagomedios"**:
   - la app llama a la Edge Function `pagomedios-payment` (acción `create`);
   - la función crea el pago `pending` en `payments` y la solicitud `POST /payment-requests`, y devuelve el link del formulario;
   - la app abre ese formulario.
4. **En el formulario de Pagomedios** el socio escribe la tarjeta y el banco aprueba o rechaza.
5. **Pagomedios avisa a la función (notify).** La función **no confía en lo que le envían**: vuelve a consultar `GET /payment-requests` con el token. Si el pago está autorizado:
   - marca el pago `approved` de forma atómica (si llega dos veces, se procesa una sola vez);
   - activa o extiende la membresía, con período de gracia de 3 días;
   - redirige al socio a la app.
6. **`/membresia/pago?paymentId=…`** muestra "Verificando…" (acción `verify`) y luego:
   - **Aprobado:** "¡Pago aprobado!" y va a Mi Plan con el plan activo.
   - **Pendiente:** mensaje y botón "Volver a verificar".
   - **Rechazado:** mensaje y botón para intentar de nuevo. La membresía no cambia.

**Web y app nativa:**
- **Web / PWA:** la pestaña va al formulario y vuelve a la app web al terminar.
- **App nativa (iOS/Android):**
  - el formulario se abre con `@capacitor/browser`, una hoja dentro de la app, así que el socio no sale de ella;
  - la app guarda el `paymentId` antes de abrirlo y, al cerrar la hoja, verifica sola el pago;
  - el redirect final de notify, cuando viene de la app nativa, muestra "Pago recibido, cierra esta ventana para volver a la app".

  No hace falta dominio ni deep links. Apple y Google permiten este cobro porque la membresía de un gimnasio es un servicio físico.

**Administrador (`/cobros`, `CobrosPage.tsx`):**
- el pago aparece en el historial como "Pagomedios (en línea)", con monto, socio, plan, fecha, estado en español y código de autorización;
- el filtro de método tiene la opción "Pagomedios (en línea)";
- hay una métrica nueva "En línea" junto a efectivo, transferencia y tarjeta;
- los pagos pendientes o rechazados se ven con su estado. No hay que registrar nada a mano.

**Métodos de pago en el mismo checkout:** el socio elige entre *Tarjeta de crédito o débito* (Pagomedios, flujo de arriba), *Efectivo en recepción* o *Transferencia bancaria*. Con efectivo o transferencia no se piden datos del pagador: se crea la solicitud pendiente, el socio ve "Solicitud enviada · Paga en recepción" y recepción la cobra y activa desde Cobros, como hoy.

## Qué incluye
- Portar el trabajo ya hecho y sin commitear del worktree `reservasGym-pagomedios` (rama `feat/pagomedios-pago-unico`, basada en el `main` viejo) a una rama nueva `feat/pagomedios-pago-unico-v2` desde el `main` actual (`af49fa6`):
  - Edge Function `supabase/functions/pagomedios-payment/`: `index.ts` con create, verify y notify, y `tax.ts` con `splitTax` (IVA 15 % incluido en el precio);
  - `PagomediosCheckoutPage.tsx` (y su test), `OnlineCheckoutPage.tsx` y `onlinePay.ts`;
  - repositorio: `createPagomediosPayment`, `verifyPagomediosPayment` y `functionErrorMessage`;
  - `pagomedios-provider.sql`, que agrega `'pagomedios'` a `payments_provider_check`;
  - scripts `pagomedios-mock.mjs` / `pagomedios-e2e.mjs`.

  Los archivos que cambiaron en `main` desde entonces se ajustan a mano: `supabaseRepository.ts`, `localRepository.ts`, `types.ts`, `models.ts`, `router.tsx`, `PlansShowcase.tsx`, `format.ts`, `vite-env.d.ts`, `schema.sql`, `package.json` y `.env.staging.example`.
- `@capacitor/browser` para la app nativa y la página de cierre para el redirect final.
- Cambios de administración en `CobrosPage.tsx` y `formatPaymentMethod` → "Pagomedios".
- Configuración local descrita arriba, y el SQL del proveedor aplicado en la base de QA.
- En `docs/tecnico/staging-setup.md`, una sección de Pagomedios con:
  - cómo correrlo en local;
  - los montos de prueba;
  - los pasos **futuros** para QA y prod, que no se ejecutan ahora: deploy de la función con `--no-verify-jwt`, secrets `PAGOMEDIOS_TOKEN`, `APP_URL` y `PAGOMEDIOS_TAX_RATE`, variables `VITE_ONLINE_PAYMENTS` y `VITE_PAYMENT_PROVIDER` en Vercel, y el checklist de Go-Live.
- `provision-staging.mjs` con el SQL nuevo.

## Qué no incluye
La app inicia el cobro, confirma el resultado con Pagomedios y activa la membresía. Lo siguiente queda fuera y **no es responsabilidad de la app**:

**Cobro y dinero**
- Procesar la tarjeta, el 3-D Secure, la aprobación o el rechazo del banco y los tiempos de acreditación: son de Pagomedios y del banco emisor.
- Reversos, reembolsos, anulaciones y contracargos: se hacen en el panel de Pagomedios. Si se reversa un pago, recepción ajusta la membresía a mano.
- Conciliación bancaria, liquidaciones y depósitos al gimnasio.
- Comisiones de Pagomedios o del banco, y quién las asume.
- Pagos diferidos, con intereses o en cuotas, y otros medios (Deuna, transferencia, links de pago, efectivo en puntos). El cobro es con tarjeta, en un pago corriente.

**Facturación y contabilidad**
- Factura electrónica del SRI (se envía `generate_invoice: 0`) y comprobantes con validez tributaria.
- Reportes contables, exportaciones a Excel o cierres de caja de los pagos en línea. El administrador ve el historial en Cobros y nada más.

**Casos especiales**
- Si Pagomedios no envía el aviso (notify) y el socio cierra sin verificar, el pago queda "pendiente" hasta que el socio o recepción vuelvan a verificar. No hay consulta automática en segundo plano.
- Devoluciones parciales, cambios de plan a mitad de período con prorrateo, y pagos a nombre de otra persona.
- Resolver fallas o caídas del servicio de Pagomedios.

**Producción**
- Activarlo en producción: queda para el Go-Live (ZCAPP-60), con el token real, el contrato del gimnasio con Pagomedios y la aprobación del cliente.
- Trámites de afiliación del gimnasio con Pagomedios o con el banco adquirente.

## Verificación
1. **Vitest:**
   - checkout: validaciones, llamada a `create`, pantallas aprobado, pendiente y rechazado;
   - en nativo, apertura con Browser (mock) y verificación al cerrar;
   - en `CobrosPage`, el filtro y la métrica "En línea";
   - `splitTax` con precios reales.
2. **E2E local sin credenciales** (`npm run pagomedios:e2e`): aprobado, rechazado y notify duplicado que no extiende dos veces.
3. **Local contra el sandbox real de Pagomedios** (app en `localhost:5173`, función en Deno, base de QA) con `socio.staging`, desde el navegador:
   - pago aprobado con Visa y con Mastercard → membresía activa y pago visible en Cobros al entrar como admin;
   - plan a **$2** → rechazado, sin cambios.

   Uso planes de prueba temporales con esos precios y los borro al final, junto con los pagos y la membresía modificada.
4. `npx tsc -b`, lint y los builds de staging y producción.
5. Commit en la rama local, **sin push**. Te muestro la evidencia de las pruebas locales. El push, el PR, el deploy a QA y el ticket de Jira quedan para cuando lo apruebes.
