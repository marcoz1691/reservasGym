# Presentación ejecutiva de ReservasGym

Deck comercial corto (7 láminas) para enviar al cliente por WhatsApp o correo. Mismo diseño visual, contenido esencial: problema, solución, áreas, planes y detalle operativo.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `ReservasGym-Presentacion.pdf` | **El entregable principal.** Envíalo tal cual por WhatsApp o correo. |
| `slides/01.jpg` … `slides/07.jpg` | Cada lámina como imagen. Plan B si el cliente no abre adjuntos. |
| `mensajes-whatsapp.md` | Textos listos para copiar y pegar. |
| `presentacion.html` | El deck fuente. Aquí se edita el contenido. |
| `render.mjs` | Script que exporta el HTML a PDF e imágenes. |

## Estructura del deck

1. Portada (personalizada para William)
2. El problema
3. La solución
4. Áreas con reserva
5. Planes y precios (pago único)
6. Qué recibe el gimnasio (detalle)
7. Cierre y contacto (Marco Zurita)

## Precios (USD, sin IVA)

- Básica: desde **$2.000** (link responsive)
- Intermedia: **$4.500** (iOS/Android + control de peso)
- Avanzada: **$6.500** (membresías, pagos y renovaciones) — recomendada
- Completa: **$9.500** (facturación + links de pago para productos)

## Antes de enviarla

Edita `presentacion.html` si cambias el destinatario en portada/cierre. El contacto actual es Marco Zurita (+593 98 320 7754 · marcoz1691@gmail.com).

Después vuelve a exportar con `npm run render`.

## Cómo regenerar el PDF y las imágenes

Requiere Node 18+ y Google Chrome instalado.

```bash
cd docs/comercial/presentacion
npm install
npm run render
```

Los precios y condiciones comerciales están en [../plan-comercial.md](../plan-comercial.md). **Si cambias un precio, cámbialo en los dos lugares.**
