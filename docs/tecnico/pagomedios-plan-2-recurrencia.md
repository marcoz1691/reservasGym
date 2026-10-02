# Pagomedios — Plan 2: pago recurrente

> Integración con Pagomedios (Abitmedia, API v2). Documento de alcance: qué hace la app, cómo es el flujo y qué **no** incluye.

Se construye sobre el [Plan 1](./pagomedios-plan-1-pago-unico.md) y reutiliza su flujo, su formulario y su verificación.


## Objetivo
El socio puede elegir "Pago recurrente mensual": registra su tarjeta en Pagomedios y paga el primer mes. Los meses siguientes el gimnasio le cobra desde el **panel de Pagomedios**. La app no controla esos cobros.

## Flujo
1. **Vitrina de planes → botón secundario "Pago recurrente mensual"**, junto a "Pagar en línea".
2. **`/membresia/pago?planId=…&modo=recurrente`**: el mismo formulario del Plan 1, con este texto: *"Registras tu tarjeta y pagas el primer mes ahora. Los meses siguientes Zona Cero hará el cobro a esta tarjeta a través de Pagomedios. Para cancelarlo, avisa en recepción."*
3. **"Pagar $X en Pagomedios"** → acción nueva `subscribe` de la Edge Function:
   - crea el pago `pending` (primer mes);
   - llama a **`POST /cards/register`** (registrar y tokenizar la tarjeta y cobrar el primer mes);
   - abre el formulario de Pagomedios, igual que en el Plan 1: pestaña en web y hoja dentro de la app en nativo.
4. **Regreso y notify**, igual que el Plan 1. Si el primer cobro está autorizado, la membresía se activa. Se verifica consultando Pagomedios; si `GET /payment-requests` no muestra registros de tarjeta, se confirma con `GET /cards?document=`, que la tarjeta quedó registrada.
5. **Meses siguientes, fuera de la app:** el gimnasio cobra desde el panel de Pagomedios a la tarjeta registrada, y recepción renueva la membresía en la app como hoy.

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
- El botón "Pago recurrente mensual" y el texto explicativo.
- La acción `subscribe` en la Edge Function, integrada con `POST /cards/register`.
- La verificación del primer cobro y la activación de la membresía (reutiliza lo del Plan 1).
- `subscribePagomedios()` en el repositorio y la variante `?modo=recurrente` del checkout.
- El primer cobro aparece en Cobros como un pago de Pagomedios más, porque es dinero real que entró.

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
1. **Vitest:** botón y texto recurrente, llamada a `subscribe`, pantallas de resultado.
2. **E2E local** con el simulador: `subscribe` → notify → membresía activa; rechazo.
3. **Local contra el sandbox real** (misma configuración del Plan 1):
   - recurrente aprobado → la tarjeta aparece en `GET /cards?document=` y la membresía queda activa;
   - monto $2 → rechazado.

   Al final se borra la tarjeta de prueba con `DELETE /cards/{token}` y se limpian los datos.
4. Checks y commit en la rama local, sin push ni deploy.
