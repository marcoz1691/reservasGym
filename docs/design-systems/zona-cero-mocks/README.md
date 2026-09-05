# Zona Cero — Maquetas de rebrand premium

Maquetas visuales de la app fusionando la marca **real** de Zona Cero Performance
Center (`docs/tipografia/`) con el sistema de diseño ya construido en `app/`.
Son maquetas estáticas para revisión — no un prototipo clicable ni el código
de la app.

**Ver publicado:** https://claude.ai/code/artifact/a4dac558-5871-4ae9-9ada-296b5b55a489

---

## Qué contiene cada archivo

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | Inicio (socio) — saludo, hero de próxima clase, métricas, sesiones |
| `Login.dc.html` | Inicio de sesión |
| `MiPlan.dc.html` | Mi Plan / tarjeta de membresía |
| `Ficha.dc.html` | Concepto de Ficha de Ingreso ampliada (paso 1 de 6) |
| `canvas.json` | Layout del canvas + notas (dirección de diseño, brechas de la ficha) |
| `assets/logo-mark.png` | Solo el monograma "Z+C", recortado del PDF real — para espacios chicos (sidebar, login) |
| `assets/logo-lockup-dark.png` | Lockup completo (marca + wordmark) en blanco sobre carbón — pág. 4 del imagotipo |
| `assets/logo-lockup-color.png` | Lockup completo a color (naranja + carbón), fondo transparente — pág. 2 |

Los `.dc.html` son el formato de **Claude Design** (canvas de artboards). Cada
uno es una página HTML autocontenida — se puede abrir directo en un navegador
para ver esa pantalla sola.

---

## De dónde sale cada decisión

Fuente: `docs/tipografia/Imagotipo zona cero.pdf` (+ `.ai` original) y
`crosers-2026-04-07-06-06-53-utc.zip`.

| Token | Valor | Origen |
|---|---|---|
| `--acc` (naranja) | `#F26D17` | Muestreado en píxel del fondo naranja sólido, pág. 3 del PDF (no un estimado visual) |
| `--elevated` / carbón de marca | `#231F20` | Muestreado en píxel del fondo carbón, pág. 4 |
| `--bg` | `#0E0B0A` | Carbón casi negro, más profundo que el de marca — se reserva `#231F20` para header/tarjetas elevadas, no como fondo raíz (a esa luminosidad "todo parece panel") |
| Corte diagonal de marca | — | Ángulo tomado de la papelería real, pág. 5 (franja naranja + cuña oscura). Aplicado solo en 2-3 puntos: header del sidebar, esquina del hero de "próxima clase", tarjeta de Mi Plan — **no** en toda la UI |
| Tipografía Crosers | `Crosers.otf` | Un solo peso, sin itálica/bold, **sin archivo de licencia en el zip**. Usado solo en 2 "momentos de marca" (nombre del socio en el saludo, título del plan en Mi Plan) — el resto de títulos sigue en Barlow Semi Condensed |
| Radios de esquina | Redondeados (`rounded-2xl`/`3xl`) | Se mantienen en formularios/tarjetas — solo el motivo diagonal es angular, no toda la forma |

**Pendiente antes de llevar esto a la app real (`app/`):** confirmar que hay
derechos de uso/redistribución sobre `Crosers.otf` — el zip no trae licencia.
Usarlo en esta maqueta (revisión privada) es de bajo riesgo; auto-alojarlo en
producción no lo es sin confirmarlo.

---

## Cómo se generó / cómo regenerarlo

Con la skill `design` de Claude Code (Claude Design canvas). Para volver a
sellar el canvas visual a partir de estos archivos:

```bash
node "<carpeta base de la skill design>/seed-canvas.mjs" \
  --template "<carpeta base>/payload.template.html" \
  --out zona-cero-rebrand.html \
  --title "Zona Cero Rebrand" \
  --artboard Main.dc.html --artboard Login.dc.html --artboard MiPlan.dc.html --artboard Ficha.dc.html \
  --image assets/logo-mark.png --image assets/logo-lockup-dark.png --image assets/logo-lockup-color.png \
  --canvas canvas.json
```

El archivo `.html` resultante (~2.7 MB, incluye el editor) no se versiona aquí
— es artefacto generado, se reconstruye con el comando de arriba y se publica
como Artifact.

---

## Brechas conocidas (no corregidas en esta maqueta)

Ver la nota `ficha-gaps-note` en `canvas.json` para el detalle exacto frente a
`docs/detalles formularios.txt`: contacto de emergencia, nivel de
entrenamiento, cuestionario PAR-Q estructurado y checkboxes de consentimiento
todavía no están construidos ni en la maqueta ni en `app/`.
