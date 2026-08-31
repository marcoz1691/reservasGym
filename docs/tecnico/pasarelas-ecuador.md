# Pasarelas de pago Ecuador — qué pedirle al cliente

Para el botón **Renovar / Pagar** de la membresía en la app.  
Mercado Pago **no** es la opción por defecto en Ecuador; lo más común es **Datafast**, **Kushki**, **PagoPlux** (Plux) o **PayPhone**.

---

## Cliente actual — Datafast físico (sin online)

**Hecho confirmado:** el gym cobra con **datáfono Datafast**, no tiene botón / Dataweb online.

### Qué entregar en Avanzada v1

| En la app | Qué hace |
|---|---|
| Panel cobros (staff) | Registrar pago: efectivo, transferencia o **tarjeta POS (Datafast)** |
| Mi plan (socio) | Ver vigencia + CTA **“Renueva en recepción”** (no abre checkout online) |
| Historial | Muestra pagos registrados por staff |

### Qué NO construir en v1

- Integración API Dataweb / checkout online
- Mercado Pago / Kushki / PagoPlux (salvo pedido explícito después)

### Upsell / fase 2 (opcional)

Si el cliente activa **Datafast comercio electrónico (Dataweb)** con su banco:

1. Pedir commerce ID + credenciales test/prod.
2. Implementar adaptador `datafast` en Edge Functions.
3. Cambiar CTA socio a **Renovar ahora** → checkout Datafast.

Hasta entonces el “botón de pagos” en la app es **informativo** (ir a recepción), no un checkout.

### Texto WhatsApp (confirmar alcance)

> Perfecto — como ya tienen Datafast en datáfono, en la app la recepción registra el cobro (efectivo, transferencia o tarjeta) y la membresía se activa al instante. El socio ve su plan y un aviso para renovar en el gym. Cuando quieran cobro desde el celular, activamos Datafast online (Dataweb) en una siguiente fase.

---

## 1. Pregunta clave al cliente (antes de cotizar la integración)

> **“¿Con qué cobran hoy las tarjetas en el gym?”**

| Respuesta típica | Qué implica para la app |
|---|---|
| Tiene **datáfono Datafast** | Preferir **Datafast / Dataweb** online (misma red, liquidación conocida) |
| Ya usa **Kushki** en web | Integrar Kushki Checkout / API |
| Usa **PagoPlux / Plux** | Botón / link / SDK PagoPlux |
| Usa **PayPhone** | Opción más simple para PYMES; wallet PayPhone |
| Solo efectivo / transferencia | v1 = **cobro manual en recepción**; online se suma después |
| “No sé / no tengo nada” | Recomendar abrir Kushki o PagoPlux según volumen |

**No asumas Mercado Pago.** Pregunta siempre qué ya tiene (físico y online).

---

## 2. Comparativa rápida (orientativa)

| Pasarela | Fortaleza en Ecuador | Ideal si… |
|---|---|---|
| **Datafast** | Red física #1, e-commerce Dataweb | Ya tiene datáfono / alto volumen |
| **Kushki** | API moderna, liquidación a banco | Quiere online limpio, multi-país |
| **PagoPlux (Plux)** | Botón web/app, QR, links | Quiere botón rápido + facturación opcional |
| **PayPhone** | Fácil de arrancar | Gym chico, sin cuenta bancaria compleja |
| **Mercado Pago** | Regional | Solo si el cliente ya la pide y tiene cuenta |

Comisiones: las asume el **gym**, no van en el precio Avanzada del software. Cifras exactas: negociar con cada proveedor.

---

## 3. Qué debe tener el cliente para el botón online

Checklist genérico (vale para Datafast / Kushki / PagoPlux):

### Cuenta y negocio
- [ ] RUC / cédula del negocio del gym
- [ ] Cuenta bancaria a nombre del gym (liquidación)
- [ ] Correo y celular del representante legal
- [ ] Cuenta **activa y aprobada** en la pasarela elegida (no solo “me registré ayer”)

### Credenciales técnicas (te las pasa a ti, no van en el repo)
- [ ] API Key / Commerce ID / Access Token (según proveedor)
- [ ] Clave secreta / webhook secret
- [ ] Ambiente **test/sandbox** + **producción** separados
- [ ] URL de retorno (success / failure) — la defines tú con la app

### Operación
- [ ] Sabe que hay **comisión % por transacción** (+ IVA según caso)
- [ ] Quién atiende contracargos / disputas (el gym + la pasarela)
- [ ] Confirmación: ¿el botón es solo membresías o también productos? (productos = Completa)

### Si ya tiene datáfono físico (Datafast)
- [ ] Número de comercio / afiliación Datafast
- [ ] Si el banco ya habilitó **comercio electrónico / Dataweb**
- [ ] Contacto del ejecutivo del banco o Datafast (a veces el online se activa aparte del datáfono)

---

## 4. Decisión técnica en ReservasGym (Avanzada)

**Arquitectura: cobro híbrido + proveedor intercambiable.**

1. **Siempre:** panel admin cobro manual (efectivo / transferencia / tarjeta POS físico).
2. **Online:** un adaptador `PaymentProvider` (`datafast` | `kushki` | `pagoplux` | `mercadopago` | `none`).
3. **Primera entrega:** implementar **una** pasarela según lo que el cliente ya tenga.
4. Si el cliente no tiene pasarela aún → entregar cobro manual + CTA “Paga en recepción”; conectar online en la misma entrega o como fase corta cuando abra cuenta.

Campo en `payments.provider` deja de ser solo `manual | mercadopago` y pasa a:

```
manual | datafast | kushki | pagoplux | mercadopago | payphone
```

---

## 5. Texto listo para WhatsApp al cliente

> Para el botón de pago en la app necesito saber con qué cobran hoy:
> 1) ¿Tienen datáfono? ¿De qué marca (Datafast u otra)?
> 2) ¿Ya cobran online (Kushki, PagoPlux, PayPhone, otra)?
> 3) Si no tienen nada online, ¿prefieren que el socio pague en recepción al inicio y después activamos el botón?
>
> Con eso te digo exactamente qué hay que abrir y qué credenciales me pasas (nunca por chat público: por correo o llamada).

---

## 6. Referencias

- Spec Avanzada: [plan-avanzada.md](./plan-avanzada.md)
- Setup legacy MP (solo si el cliente lo elige): [mercadopago-setup.md](./mercadopago-setup.md)
