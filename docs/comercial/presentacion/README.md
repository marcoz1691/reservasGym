# Presentación ejecutiva de ReservasGym

Deck comercial de 14 láminas para enviar al cliente por WhatsApp o correo. Está escrito en lenguaje de usuario final: sin tecnicismos y centrado en ocupación, retención y tiempo del equipo.

## Qué hay en esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `ReservasGym-Presentacion.pdf` | **El entregable principal.** Envíalo tal cual por WhatsApp o correo. |
| `slides/01.jpg` … `slides/14.jpg` | Cada lámina como imagen 1920x1080. Plan B para el cliente que no abre archivos adjuntos. |
| `mensajes-whatsapp.md` | Textos listos para copiar y pegar: primer contacto, envío, seguimiento y cierre. |
| `presentacion.html` | El deck fuente. Aquí se edita el contenido. |
| `render.mjs` | Script que exporta el HTML a PDF e imágenes. |

## Cómo se ve

Se abre `presentacion.html` en cualquier navegador y se recorre haciendo scroll. Cada sección `.slide` es una lámina de 1280x720 px (16:9).

## Estructura del deck

1. Portada
2. El problema: lo que pasa hoy en el gimnasio
3. La solución en tres pilares
4. Recorrido del socio, con la app en pantalla
5. Lista de espera automática
6. Panel de control del gimnasio
7. Todo lo que hace la app
8. Funciona en lo que ya tienes
9. El caso de negocio y el retorno
10. Planes y precios
11. Complementos futuros
12. Puesta en marcha en dos semanas
13. Preguntas frecuentes
14. Cierre: prueba de 30 días y contacto

## Antes de enviarla a un cliente

Edita `presentacion.html` y reemplaza:

- **Lámina 14:** `[Tu nombre]`, `[09xx xxx xxx]` y `[tucorreo@dominio.com]` por tus datos reales.
- **Lámina 1:** el pie dice "Propuesta preparada para tu gimnasio". Cámbialo por el nombre del cliente; personalizar la portada sube muchísimo la tasa de respuesta.
- **Lámina 9:** el ejemplo usa 400 socios a $35. Si conoces las cifras reales del cliente, úsalas.

Después vuelve a exportar con `npm run render`.

## Cómo regenerar el PDF y las imágenes

Requiere Node 18 o superior y Google Chrome instalado (no descarga ningún navegador: usa el del sistema).

```bash
cd docs/comercial/presentacion
npm install
npm run render
```

Si Chrome está en una ruta no estándar:

```bash
CHROME_PATH="/ruta/a/google-chrome" npm run render
```

El script sobrescribe `ReservasGym-Presentacion.pdf` y regenera por completo la carpeta `slides/`.

## Relación con el resto de la documentación

Los precios, condiciones comerciales, manejo de objeciones y proyección de ingresos están en [../plan-comercial.md](../plan-comercial.md). **Si cambias un precio, cámbialo en los dos lugares.**
