# Pagomedios — Plan 2: pago recurrente

> Integración con Pagomedios (Abitmedia, API v2). Documento de alcance: qué hace la app, cómo es el flujo y qué **no** incluye.

Se construye sobre el [Plan 1](./pagomedios-plan-1-pago-unico.md) y reutiliza su flujo, su formulario y su verificación.


## Objetivo
El socio puede elegir "Pago recurrente mensual": registra su tarjeta en Pagomedios y paga el primer mes. Los meses siguientes el gimnasio le cobra desde el **panel de Pagomedios**. La app no controla esos cobros.

## Flujo
Comprobado contra el sandbox el 11-oct-2026 (`e2e/pagomedios-recurrencia.e2e.ts`).

1. **Vitrina de planes → botón secundario "Pago recurrente mensual"**, junto al botón principal. Solo aparece en planes mensuales (28 a 31 días, no pase del día), con el pago en línea encendido y `VITE_RECURRING_PAYMENTS=1`.
2. **`/membresia/pago?planId=…&modo=recurrente`**: el mismo formulario de facturación del Plan 1, solo con tarjeta, y el texto de la adenda: *"Registras tu tarjeta y pagas el primer mes ahora. Los meses siguientes Zona Cero hará el cobro a esta tarjeta a través de Pagomedios. Para cancelarlo, avisa en recepción."* También avisa de la validación de $1,15.
3. **"Registrar tarjeta y pagar"** → `create` con `recurring: true` en la Edge Function:
   - crea el pago `pending` por el valor del plan, con la nota `Pago recurrente (ID <cédula>): registro de tarjeta en curso.`;
   - llama a **`POST /cards/register`**. Pagomedios ignora el monto y crea un "Registro de tarjeta" de **$1,15**, que autoriza y **reversa solo** (queda en estado 3 con código de autorización);
   - abre el formulario "Registrar tarjeta" de Pagomedios (pestaña en web, ventana dentro de la app en nativo).
4. **Notify / verify** (`verifyRecurring` en `recurring.ts` + `index.ts`):
   - `GET /payment-requests?uuid=` confirma el registro (estado 1 o 3 con código de autorización);
   - `GET /cards?document=` da el token de la tarjeta nueva. El `cardToken` del notify solo se usa si Pagomedios lo lista para ese documento;
   - **`POST /cards/charge`** cobra el primer mes con referencia fija por pago (`ZC…`, 20 caracteres). La nota del pago hace de candado: solo quien la pasa de "registro" a "cobrando" cobra, así que nunca se cobra dos veces;
   - si se autoriza, el pago se aprueba y `apply_plan_purchase` activa o extiende la membresía, igual que en el Plan 1. Si se rechaza, el pago queda rechazado y la tarjeta se borra de Pagomedios (`DELETE /cards/{token}`). Si no hay respuesta clara, la nota queda en "Requiere revisión" y no se reintenta;
   - `POST /cards/charge` no aparece después en `GET /payment-requests`: su respuesta es la única constancia, por eso el código de autorización se guarda en `payments.mp_payment_id`.
5. **Meses siguientes, fuera de la app:** el gimnasio cobra desde el panel de Pagomedios a la tarjeta registrada, y recepción renueva la membresía en la app como hoy.

La app no guarda tokens ni datos de la tarjeta. La cédula va en la nota del pago porque `GET /cards` la exige.

## ¿Qué pasa con la vigencia cuando Pagomedios cobra solo cada mes?
Aunque Pagomedios cobre la tarjeta cada mes de forma automática, **la app no se entera de ese cobro**. La API no avisa a la app de los cobros siguientes; solo del primero. Entonces:

1. **Primer pago (día 1):** la app activa el plan por su duración (por ejemplo, 30 días) y suma 3 días de gracia.
2. **Día 31:** Pagomedios cobra el segundo mes. El dinero entra al gimnasio, pero en la app el plan **vence igual**.
3. **Días 31 a 33 (gracia):** el socio sigue reservando y ve el aviso de "período de gracia".
4. **Día 34 en adelante:** la app lo marca **vencido** y **no lo deja reservar ni hacer check-in**, aunque ya haya pagado.
5. **Solución en este plan:** recepción revisa en el panel de Pagomedios los cobros del día y **renueva a mano** en la app a cada socio con débito (en Cobros, "registrar pago", método tarjeta, con la referencia de Pagomedios). Así el plan se extiende 30 días más.

**Riesgo para el gimnasio:** si recepción no renueva a tiempo, un socio que pagó queda bloqueado y reclama. Este riesgo es del proceso del gimnasio, no de la app, y queda aceptado al elegir esta versión.

**Si más adelante quieren que la vigencia se renueve sola:**
- Hay que confirmar con Pagomedios si su cobro automático envía un aviso (notify) por cada cargo, con qué datos y a qué URL.
- Si lo envía, la app puede recibirlo, identificar al socio, extender el plan sin duplicar y mostrar el débito en el historial.
- Es un desarrollo adicional que se cotiza aparte. No forma parte de este plan.

## Qué incluye
- El botón "Pago recurrente mensual" en la vitrina y el modo `?modo=recurrente` del checkout, con el texto de la adenda.
- `create` con `recurring: true` en la Edge Function, integrada con `POST /cards/register`, y el cobro del primer mes con `GET /cards` + `POST /cards/charge` (`recurring.ts`).
- La verificación del registro y del primer cobro, y la activación de la membresía con `apply_plan_purchase`, igual que en el Plan 1.
- `createPagomediosPayment({ …, recurring: true })` en el repositorio.
- El primer cobro aparece en Cobros como un pago de Pagomedios más, con la nota "Pago recurrente…", porque es dinero real que entró. El comprobante del socio dice que la tarjeta quedó registrada.

## Qué no incluye
La app registra la tarjeta en Pagomedios y cobra el primer mes. **Todo el control de los cobros siguientes lo tienen Pagomedios y el gimnasio**, y la app no se responsabiliza de ello. En concreto, la app **no**:

**Cobros de los meses siguientes**
- Programa, lanza ni calcula los cobros mensuales. Los hace el gimnasio desde el panel de Pagomedios (fecha, monto y frecuencia los decide el gimnasio allí).
- Reintenta un cobro cuando el banco lo rechaza, ni define cuántos reintentos hacer ni cada cuánto.
- Se entera de los cobros mensuales: no recibe avisos de cargos aprobados, rechazados o reversados después del primero.
- Garantiza que el monto cobrado coincida con el precio vigente del plan si el plan cambia de precio.

**Membresía**
- Extiende la membresía cuando entra un cobro mensual. Recepción renueva a mano, como hoy, después de revisar el cobro en Pagomedios.
- Evita que un socio quede vencido si el gimnasio no cobró o no renovó a tiempo.
- Bloquea, suspende ni marca "en atraso" a un socio por un cobro recurrente fallido.
- Evita cobros duplicados entre un cobro recurrente y un pago en recepción del mismo mes: recepción debe revisar Pagomedios antes de cobrar a mano.

**Para el socio**
- Mostrar en Mi Plan que tiene débito activo, la tarjeta registrada, la próxima fecha de cobro o el historial de cargos.
- Cancelar el débito o cambiar o borrar la tarjeta desde la app: lo pide en recepción y el gimnasio lo hace en Pagomedios.
- Avisos, notificaciones o correos de cobro próximo, cobro exitoso o cobro fallido.
- Aceptar términos del débito dentro de la app, más allá del texto informativo en la pantalla de pago.

**Para recepción y administración**
- Panel o lista de socios con débito (activo, en atraso o cancelado), próximos cobros y fallos.
- Alerta al registrar un cobro manual a un socio que tiene débito.
- Reportes, conciliación o métricas de recurrencia. Los cobros siguientes no aparecen en Cobros; el primer cobro aparece como un pago de Pagomedios más.
- Consulta de respaldo o cuadre automático con Pagomedios si algo no coincide.

**Datos y seguridad**
- Guardar tokens de tarjeta, suscripciones o datos de la tarjeta en la base de la app.
- Custodia de los datos de la tarjeta y cumplimiento PCI: son de Pagomedios.

**Tampoco incluye** lo mismo que queda fuera del Plan 1: facturación SRI, comisiones, reversos, diferidos, otros medios de pago ni la activación en producción.

Cualquiera de estos puntos, si el cliente lo pide después, se cotiza aparte como un cambio de alcance.

## Verificación
1. **Vitest:** `src/test/pagomediosRecurring.test.ts` (reglas puras), checkout recurrente y botón de la vitrina.
2. **Local contra el sandbox real y la base de QA:** `SUPABASE_ACCESS_TOKEN=… npx playwright test -c e2e/playwright.config.ts pagomedios-recurrencia`:
   - el pase del día no admite débito;
   - registro aprobado → primer mes cobrado, membresía extendida exactamente 30 días, la tarjeta queda en `GET /cards`, verify y un notify repetido no cobran dos veces;
   - cobro rechazado ($2) → pago rechazado, sin membresía y la tarjeta se borra.

   Al final borra las tarjetas de prueba y deja QA como estaba.
3. Checks y commit en la rama local `feat/pagomedios-recurrencia`, sin push ni deploy.
