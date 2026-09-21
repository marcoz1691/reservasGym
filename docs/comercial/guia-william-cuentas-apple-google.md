# Guía para el Cliente — Crear cuentas Apple y Google Play
## Zona Cero Performance Center

**Para:** William Ricardo Ramírez Salguero (Zona Cero)  
**Preparado por:** Marco Zurita (desarrollo de la app)  
**Objetivo:** Que las cuentas queden **a nombre del gym**, para publicar la app en App Store y Google Play.  
**Tiempo estimado:** Google ~20–30 min · Apple ~40–60 min (si Apple pide verificación, puede tardar días extra).  
**Cuándo hacerlo:** Sprint 3 (aprox. última semana de septiembre / inicios de octubre 2026).

Si en algún paso te trabas o Apple/Google pide algo raro, **deja una captura y avísame** (WhatsApp/correo). No hace falta terminar todo el mismo día.

---

## Antes de empezar — Checklist de materiales

Ten a la mano:

| # | Qué | Notas |
|---|-----|--------|
| 1 | **Correo del gym** | Ideal uno de Gmail o del negocio que uses siempre (no uno personal que luego pierdas). Ejemplo: `zonacerocenter@gmail.com`. |
| 2 | **Teléfono celular** | Para códigos SMS de verificación. |
| 3 | **Datos del RUC / negocio** | Nombre comercial, razón social, dirección en Quito, teléfono. |
| 4 | **Cédula o pasaporte** del representante legal / propietario. |
| 5 | **Tarjeta de crédito o débito** | Para pagar a Apple y Google. Puede ser del negocio o tuya como representante. |
| 6 | **Computadora** | Chrome o Safari. Evita hacerlo solo desde el celular si puedes. |

### Costos (se pagan directo a Apple / Google — no al desarrollador)

| Cuenta | Costo aproximado | Frecuencia |
|--------|------------------|------------|
| **Google Play Console** | **USD 25** | Una sola vez |
| **Apple Developer Program** | **USD 99** | Cada año |

---

## PARTE A — Google Play (Android) — hazla primero

Es la más sencilla. Si esta sale bien, ya tienes una lista.

### Paso A1 — Entrar a Google Play Console

1. Abre en el navegador: [https://play.google.com/console](https://play.google.com/console)
2. Inicia sesión con el **correo del gym** (el que decidiste en el checklist).
3. Si Google pide verificar el correo o el teléfono, hazlo.

### Paso A2 — Crear la cuenta de desarrollador

1. Busca el botón tipo **“Crear cuenta” / “Create account” / “Empezar”**.
2. Elige el tipo de cuenta:
   - Preferible: **Organización / Empresa** (si el gym tiene RUC).
   - Alternativa: **Particular / Individual** (si Google no deja empresa de una).
3. Completa:
   - Nombre del desarrollador (puede ser: **Zona Cero Performance Center**)
   - Datos de contacto
   - Dirección del gym
4. Acepta los términos de Google Play.

### Paso A3 — Pagar los USD 25

1. Google pedirá tarjeta para el **pago único de registro**.
2. Paga con la tarjeta preparada.
3. Guarda el correo de confirmación de pago.

### Paso A4 — Completar el perfil (si lo pide)

Google a veces pide después:

- Sitio web o página de Facebook/Instagram del gym  
- Teléfono  
- Verificar identidad (subir foto de cédula)

Complétalo si aparece. Si pide “cuenta de pagos / merchant”, **puedes dejarlo para después** (no bloquea crear la cuenta).

### Paso A5 — Confirmación Google

Cuando termines, deberías ver el panel de **Play Console** con tu nombre / Zona Cero.

**Avísame por WhatsApp:** “Google listo” + captura de la pantalla principal de Play Console.

---

## PARTE B — Apple Developer (iPhone / App Store)

Apple es un poco más estricto. Hazlo con calma.

### Decisión importante: Individual vs Organization

| Tipo | Cuándo usarlo | Qué implica |
|------|----------------|-------------|
| **Organization (Organización)** | Recomendado si el gym tiene **RUC** y quieres que figure la empresa | Apple puede pedir documentos del negocio (D-U-N-S). Tarda más, pero es lo correcto a largo plazo. |
| **Individual (Individual)** | Si no tienes RUC listo o Apple complica la empresa | Queda a nombre de **ti como persona**. La app puede publicarse igual; más adelante se puede migrar (con trámites). |

**Recomendación para Zona Cero:** intenta primero **Organization**. Si se complica el D-U-N-S, avísame y vemos Individual.

### Paso B1 — Crear / entrar a Apple ID

1. Abre: [https://appleid.apple.com](https://appleid.apple.com)
2. Si **no** tienes Apple ID con el correo del gym:
   - Crea uno nuevo con ese correo.
   - Verifica correo y teléfono.
3. Si ya tienes Apple ID personal, **mejor usa/crea uno del gym** para no mezclar cuentas.

### Paso B2 — Entrar al programa de desarrolladores

1. Abre: [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/)
2. Inicia sesión con el Apple ID del gym.
3. Pulsa **Start Your Enrollment** / **Comenzar inscripción**.

### Paso B3 — Elegir tipo de entidad

1. Elige **Organization** (ideal) o **Individual**.
2. Si eliges Organization, completa:
   - Legal Entity Name (razón social / nombre legal)
   - D-U-N-S Number (si lo piden — ver nota abajo)
   - Dirección del negocio
   - Contacto del gym

#### Nota sobre D-U-N-S (solo Organization)

Apple suele pedir un número **D-U-N-S** (identificador de empresa de Dun & Bradstreet).

- Solicitud gratuita: [https://developer.apple.com/enroll/duns-lookup/](https://developer.apple.com/enroll/duns-lookup/)
- Si el gym **aún no tiene** D-U-N-S, el trámite puede tardar **varios días**.
- Si te bloquea aquí: **avísame** con captura. Opciones: esperar D-U-N-S o usar Individual por ahora.

### Paso B4 — Verificar identidad

Apple pedirá:

- Nombre como en la cédula  
- Fecha de nacimiento  
- Posible verificación con documento  

Completa exactamente como en tu documento.

### Paso B5 — Pagar los USD 99 / año

1. Apple pedirá tarjeta para la membresía anual.
2. Paga y guarda el comprobante / correo.
3. A veces el estado queda en **“Pending” / Pendiente** unos días mientras Apple revisa.

### Paso B6 — Confirmación Apple

Cuando Apple apruebe, recibirás un correo tipo: *“Welcome to the Apple Developer Program”*.

Entra a: [https://developer.apple.com/account](https://developer.apple.com/account)  
Debes ver tu membresía **Active**.

**Avísame por WhatsApp:** “Apple listo” + captura de la cuenta Active (puedes tapar datos sensibles).

---

## Qué NO tienes que hacer todavía

Esto lo hacemos **después** (conmigo), cuando la app esté lista para publicar:

- Subir la app / archivos técnicos  
- Capturas de pantalla de la tienda  
- Textos largos de descripción  
- Certificados y firmas técnicas  

Tu trabajo ahora es **solo crear y pagar las cuentas**.

---

## Resumen de entregables (cuando termines)

Mándame un mensaje así:

```
Google Play: LISTO / PENDIENTE
Correo usado Google: _______________

Apple: LISTO / PENDIENTE / EN REVISIÓN
Apple ID (correo): _______________
Tipo: Individual / Organization

Dudas o bloqueos:
- ...
```

---

## Problemas frecuentes

| Problema | Qué hacer |
|----------|-----------|
| La tarjeta es rechazada | Prueba otra tarjeta; asegúrate de que permita pagos internacionales / USD. |
| Apple pide D-U-N-S y no lo tengo | Solicítalo en el link de arriba y avísame. Podemos pausar Apple unos días. |
| No llega el SMS / correo | Revisa spam; espera 10 min; reenvía el código. |
| No entiendo un campo en inglés | Foto de la pantalla + WhatsApp. Te digo exactamente qué poner. |
| Me pide “website” y no tengo web | Usa Instagram/Facebook del gym o avísame y te doy una URL provisional. |

---

## Contacto

Cualquier duda en el proceso: **avísame a Marco** por WhatsApp/correo.  
No hace falta llamada obligatoria; con capturas basta.

**Enlace del ticket interno (referencia):** ZCAPP-29 — Cuentas Apple Developer y Google Play.
