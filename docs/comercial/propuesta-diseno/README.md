# Propuesta de diseño — visor para el cliente

`index.html` es un **visor autónomo** con las dos propuestas de diseño de la app.
Un solo archivo, sin dependencias ni servicios de terceros: se abre con doble
clic o se sube a cualquier hosting estático.

## Qué incluye

- Las **34 pantallas** (17 por opción) en un menú lateral agrupado por Socio,
  Recepción/Administración y Ficha de ingreso.
- Interruptor **Opción 1 · Claro** / **Opción 2 · Negro** que cambia la pantalla
  actual sin perder el lugar.
- Zoom 30 %–150 %.
- Atajos: `←` `→` recorren pantallas, `1` y `2` cambian de opción.

## Cómo publicarlo

**Opción rápida (sin cuenta, 30 segundos):** entra a
[app.netlify.com/drop](https://app.netlify.com/drop) y arrastra la carpeta
`propuesta-diseno`. Te devuelve una URL inmediata del tipo
`https://xxxx.netlify.app`. En Site settings → Change site name se le puede
poner algo como `zonacero-diseno`.

**Alternativas:** Cloudflare Pages (también con drag & drop), GitHub Pages, o
cualquier hosting propio subiendo el archivo por FTP.

**Sin publicar:** el archivo funciona con doble clic. Se puede enviar por correo
o WhatsApp como adjunto, aunque pesa ~1 MB y algunos clientes de correo bloquean
los `.html`; comprimirlo en `.zip` lo resuelve.

## Cómo regenerarlo

Desde `docs/design-systems/zona-cero-mocks/`:

```bash
node _build-viewer.mjs
```

Toma los `.dc.html` de las dos opciones, los convierte a HTML plano (quita el
envoltorio del formato de artboards), incrusta los logos como data URI y arma
el `index.html`. Cada pantalla se monta en su propio `<iframe srcdoc>` para
aislar el CSS: todas declaran `:root` con los mismos nombres de token y
colisionarían si se inyectaran en el mismo documento.

Luego se copia el resultado a esta carpeta.
