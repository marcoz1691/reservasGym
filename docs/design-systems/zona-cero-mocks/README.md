# Zona Cero — Maquetas de rebrand (minimalista)

Maquetas visuales de la app fusionando la marca **real** de Zona Cero Performance
Center con el patrón minimalista del login de **GYM-One** (el sistema de
referencia del cliente). Son maquetas estáticas para revisión — no un prototipo
clicable ni el código de la app.

**Ver publicado:** https://claude.ai/code/artifact/a4dac558-5871-4ae9-9ada-296b5b55a489

---

## Qué contiene cada archivo

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | Inicio (socio) — saludo, próxima clase, métricas, sesiones |
| `Login.dc.html` | Inicio de sesión |
| `MiPlan.dc.html` | Mi Plan / tarjeta de membresía |
| `Ficha.dc.html` | Concepto de Ficha de Ingreso (paso 1 de 6) |
| `canvas.json` | Layout del canvas + notas (dirección, brechas de la ficha) |
| `assets/logo-color.png` | Lockup completo a color, recortado al bounding box — para el login |
| `assets/mark-color.png` | Solo el monograma "Z+C" a color — para el sidebar |
| `assets/logo-mark.png` | Monograma en blanco sobre carbón (variante para fondos oscuros) |
| `assets/logo-lockup-dark.png` | Lockup completo en blanco sobre carbón — pág. 4 del imagotipo |
| `assets/logo-lockup-color.png` | Lockup a color sin recortar — pág. 2 |

Los `.dc.html` son formato **Claude Design** (canvas de artboards). Cada uno es
una página HTML autocontenida — se puede abrir directo en un navegador.

---

## Dirección de diseño

Referencia tomada de `GYM-One/login/index.php` (el login real que el cliente ya
usa): fondo claro con patrón de puntos sutil, tarjeta blanca con sombra suave,
radios chicos, animación de entrada escalonada, y **un solo color de acento**
para el botón primario y los links.

| Decisión | Valor / criterio |
|---|---|
| Fondo | `#F6F5F2` — neutro cálido claro (GYM-One usa `#f4f6fb`, aquí se calienta para acompañar al naranja) |
| Superficie | `#FFFFFF` con `1px` de borde `#E7E4DF` y sombra suave |
| Radios | 8–16px (GYM-One usa 13–18px) — nada de esquinas de 24px+ |
| Tipografía | IBM Plex Sans en un solo eje de pesos (400/500/600/700) + IBM Plex Mono para etiquetas de dato |
| Acento `#F26D17` | Muestreado en píxel del fondo naranja sólido del imagotipo. Usado **solo** en: botón primario, item activo del sidebar, borde superior de la tarjeta de plan, links y el eyebrow "Tu próxima clase" |
| Carbón `#231F20` | Muestreado del imagotipo. Es el color de texto **sobre** el botón naranja (contraste ≈ 5.9:1, pasa AA; blanco sobre naranja falla con 2.76:1) |
| Estados | Verde/ámbar/rojo desaturados en versión "label" (fondo tenue + texto oscuro), como los `.bg-label-*` de GYM-One |
| Animación | Solo en el login: entrada de la tarjeta + escalonado de campos, con `prefers-reduced-motion` respetado — igual que GYM-One |

**Se descartaron** (de una primera versión oscura): cortes diagonales, glows,
gradientes y la tipografía Crosers. El logo ya carga toda la personalidad
angular de la marca; repetirla en la UI la volvía ruidosa.

---

## Cómo regenerar el canvas

Con la skill `design` de Claude Code:

```bash
node "<carpeta base de la skill design>/seed-canvas.mjs" \
  --template "<carpeta base>/payload.template.html" \
  --out zona-cero-rebrand.html \
  --title "Zona Cero Rebrand" \
  --artboard Main.dc.html --artboard Login.dc.html --artboard MiPlan.dc.html --artboard Ficha.dc.html \
  --image assets/logo-color.png --image assets/mark-color.png \
  --canvas canvas.json
```

El `.html` resultante (~2.7 MB, incluye el editor) no se versiona — es artefacto
generado.

---

## Pendientes

- **Fuentes de marca perdidas:** `docs/tipografia/` (el PDF del imagotipo, el
  `.ai` y el zip de Crosers) ya no está en el repo — eran archivos sin versionar
  y desaparecieron. Los PNG de `assets/` son lo único que quedó de esos activos;
  conviene recuperar los originales y versionarlos.
- **Ficha de ingreso:** ver la nota `ficha-gaps-note` en `canvas.json`. Contacto
  de emergencia, nivel de entrenamiento, cuestionario PAR-Q estructurado y
  checkboxes de consentimiento no están construidos ni en la maqueta ni en `app/`.
- **Aplicar a `app/`:** la app hoy corre un tema **oscuro**. Adoptar esta
  dirección clara implica remapear los tokens de `app/src/index.css` — es una
  decisión a confirmar antes de tocar código.
