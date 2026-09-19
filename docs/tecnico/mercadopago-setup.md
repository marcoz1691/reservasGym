# Setup Mercado Pago — ReservasGym Avanzada

Guía para configurar cobros de membresía en **Ecuador** con Mercado Pago Checkout Pro.

---

## 1. Requisitos del gimnasio

1. Cuenta Mercado Pago activa en Ecuador (persona natural o jurídica).
2. Credenciales de producción y prueba en [Mercado Pago Developers](https://www.mercadopago.com/developers/panel/app) (iniciar sesión con la cuenta EC).
3. Cuenta bancaria vinculada para retiros.
4. Comisiones MP asumidas por el gimnasio (no incluidas en el precio del software).

> **Nota:** la ruta antigua `mercadopago.com.ec/developers` ya no existe. Usar el panel global:
> - Inicio: https://www.mercadopago.com/developers/es  
> - Tus integraciones / apps: https://www.mercadopago.com/developers/panel/app  

---

## 2. Credenciales

| Credencial | Uso | Dónde guardar |
|---|---|---|
| Public Key | Opcional en cliente (Brick) | No usada en v1 (Checkout Pro redirect) |
| Access Token | Crear preferencias, consultar pagos | Supabase secret `MP_ACCESS_TOKEN` |
| Webhook secret | Validar notificaciones | Supabase secret `MP_WEBHOOK_SECRET` |

**Nunca** poner el Access Token en `.env` de Vite ni en el repositorio.

---

## 3. Sandbox (desarrollo)

1. Crear aplicación en MP Developers → modo **Test**.
2. Usar **Access Token de prueba** en Edge Functions del proyecto Supabase **staging**.
3. Tarjetas de prueba MP Ecuador (documentación oficial).
4. Webhook URL apuntando a Supabase Edge **staging**:
   ```
   https://<project-ref-staging>.supabase.co/functions/v1/mp-webhook
   ```
5. Eventos: `payment` (created, updated).

> Producción usa otro proyecto Supabase + Access Token prod + webhook distinto. Nunca mezclar.

---

## 4. Edge Functions

### create-mp-preference

- Input: `{ planId, userId }` (JWT del socio validado).
- Crea fila `payments` status `pending`.
- Llama API MP `POST /checkout/preferences` con:
  - `items`: título plan, `unit_price`, `quantity: 1`, `currency_id: USD`
  - `external_reference`: payment.id
  - `back_urls`: success/failure/pending → app `/membresia`
  - `notification_url`: webhook
  - `payer.email`: email del socio
- Retorna `init_point` al cliente.

### mp-webhook

- Recibe notificación MP.
- Consulta pago por ID si hace falta.
- Si `status === approved` y `mp_payment_id` no procesado:
  - UPDATE payment → approved
  - Extender membership (misma regla que cobro manual)
- Responde 200 siempre tras persistir (evitar reintentos infinitos mal manejados).

---

## 5. Secrets Supabase

```bash
supabase secrets set MP_ACCESS_TOKEN=APP_USR-...
supabase secrets set MP_WEBHOOK_SECRET=...
```

Deploy:

```bash
supabase functions deploy create-mp-preference
supabase functions deploy mp-webhook
```

---

## 6. Producción

1. Cambiar a Access Token **producción**.
2. Registrar webhook en panel MP producción.
3. Probar un cobro real mínimo antes de entregar al cliente.
4. Documentar al gym: disputas y contracargos se gestionan en MP.

---

## 7. Fallback sin MP

`LocalRepository` y modo demo permiten cobro **manual** sin credenciales MP. El socio ve Mi plan pero el CTA Renovar muestra mensaje si Edge no está configurado.

---

## 8. Checklist

- [x] Edge Functions en repo: `create-mp-preference`, `mp-webhook`
- [x] Columna `payments.mp_payment_id` (staging)
- [x] CTA **Pagar en línea** en Mi Plan (QA / Supabase)
- [ ] Cuenta MP Ecuador del gym + Access Token **TEST**
- [ ] Secrets en Supabase staging: `MP_ACCESS_TOKEN`, `APP_URL=https://zona-cero-qa.vercel.app`
- [ ] Webhook en MP Developers → `https://kqhmclbexnnsbzbgerbx.supabase.co/functions/v1/mp-webhook`
- [ ] Pago sandbox exitoso → membresía extendida
- [ ] Pago producción de prueba (Go-Live)

### Activar en staging (una vez)

1. [Mercado Pago Developers → Tus integraciones](https://www.mercadopago.com/developers/panel/app) → credenciales de **prueba** (Access Token).
2. Supabase Dashboard → Project Settings → Edge Functions → Secrets:
   - `MP_ACCESS_TOKEN` = Access Token de prueba (`TEST-...` o `APP_USR-...` sandbox)
   - `APP_URL` = `https://zona-cero-qa.vercel.app`
3. En MP → Webhooks: URL del `mp-webhook` (arriba), eventos `payment`.
4. Redeploy QA frontend si hace falta. En **Mi Plan** → **Pagar en línea**.

Sin `MP_ACCESS_TOKEN`, el botón aparece en QA pero el servidor responde que la pasarela no está configurada.
