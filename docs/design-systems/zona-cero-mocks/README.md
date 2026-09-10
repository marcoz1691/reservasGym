# Zona Cero — Maquetas de la app

Maquetas visuales de **todas** las pantallas de la app, en **dos opciones de
diseño** sobre la misma estructura. Son maquetas estáticas para revisión — no un
prototipo clicable ni el código de la app.

**Ver publicado:** https://claude.ai/code/artifact/a4dac558-5871-4ae9-9ada-296b5b55a489

| | Opción 1 · Claro | Opción 2 · Black premium |
|---|---|---|
| Fondo | `#F6F5F2` claro con puntos sutiles | `#0A0A0B` negro |
| Color de acción | Naranja de marca `#F26D17` | **Blanco** (botón blanco, texto negro) |
| Logo | A color (naranja + carbón) | Blanco puro |
| Estados | Verde/ámbar/rojo desaturado | Salvia / arena / terracota, muy apagados |
| Referencia | Login real de GYM-One | Monocromía tipo producto premium |
| Archivos | `Nombre.dc.html` | `NombreBlack.dc.html` |

Las dos opciones tienen las **mismas 17 pantallas en el mismo layout**, para
poder compararlas una a una. El canvas se divide en 6 páginas (3 por opción):
Socio, Staff y Ficha.

**Por qué el acento blanco en la Opción 2:** sobre negro, el naranja de marca se
vuelve estridente y compite con el contenido. Un botón blanco sobre negro lee
como premium y deja que el logo sea el único portador del color de marca.



## Pantallas

### Socio (9)

| Artboard | Ruta en la app | Contenido |
|---|---|---|
| `Login.dc.html` | `/login` | Acceso + accesos demo |
| `Main.dc.html` | `/` | Saludo, próxima clase, métricas, próximas sesiones |
| `Agenda.dc.html` | `/agenda` | Grilla semanal, filtros por disciplina, detalle de sesión |
| `MisReservas.dc.html` | `/reservas` | Confirmadas, lista de espera, cancelar/reagendar/QR |
| `MiPlan.dc.html` | `/membresia` | Membresía, vigencia, métodos de pago, planes |
| `Explorar.dc.html` | `/explorar` | Las 9 disciplinas con aforo y acceso por plan |
| `Peso.dc.html` | `/peso` | Peso, gráfica de progreso, IMC, objetivo, historial |
| `Perfil.dc.html` | `/perfil` | Datos, ficha técnica, biometría |
| `CheckIn.dc.html` | `/check-in` | QR de asistencia con ventana de validez |

### Staff / Admin (5)

| Artboard | Ruta | Contenido |
|---|---|---|
| `Admin.dc.html` | `/admin` | Ocupación del día, acciones rápidas, estado de membresías |
| `Cobros.dc.html` | `/admin/cobros` | Buscar socio, cobrar (Datafast/efectivo/transferencia), vencidos, caja del día |
| `Planes.dc.html` | `/admin/planes` | Tabla de planes + editor con acceso por disciplina |
| `Sesiones.dc.html` | `/admin/sesiones` | Tabla de sesiones + editor con cupo y lista de espera |
| `Marca.dc.html` | `/admin/marca` | Nombre, logo, color de acento y vista previa |

### Ficha de ingreso (3)

`Ficha.dc.html` · `Ficha2.dc.html` · `Ficha3.dc.html` — ver sección siguiente.

---

## El formulario: de 6 pasos a 3

Las 8 secciones de `detalles formularios.txt` se agrupan en **3 pasos**, no 6.
Razón: la ficha se llena **una sola vez** y seis pantallas numeradas se sienten
interminables en el celular, que es donde la va a llenar el socio.

| Paso | Agrupa |
|---|---|
| **1 · Datos del socio** | Datos personales + foto + contacto de emergencia |
| **2 · Tu entrenamiento** | Objetivo, nivel, frecuencia/horario + evaluación inicial (IMC calculado) |
| **3 · Salud y autorizaciones** | Cuestionario PAR-Q + checkboxes de consentimiento |

Decisiones minimalistas del paso 3:

- Las 5 preguntas de seguridad son filas **Sí/No**, y **solo la que responde
  "Sí" despliega** su campo de detalle. Sin "Sí", el paso es una lista corta de
  cinco líneas.
- Si hay un "Sí" relevante, aparece un aviso ámbar explicando que recepción
  pedirá certificado médico — la regla del documento, hecha visible en el momento
  en que aplica.
- Progreso = una barra fina, no seis pestañas numeradas.
- Los campos opcionales van marcados como tales; el resto se asume requerido.

---

## Dirección de diseño

Ambas opciones comparten estructura, tipografía, radios y densidad. Solo cambian
los tokens de color y el logo.

### Opción 1 · Claro

Referencia: `GYM-One/login/index.php` y `GYM-One/assets/css/dashboard.css`.

| Decisión | Valor / criterio |
|---|---|
| Fondo | `#F6F5F2` — neutro cálido claro (GYM-One usa `#f4f6fb`; se entibia para acompañar al naranja) |
| Superficie | `#FFFFFF`, borde `1px #E7E4DF`, sombra suave |
| Acento `#F26D17` | Muestreado en píxel del imagotipo. **Solo** en botón primario, item activo, borde del plan actual y links |
| Carbón `#231F20` | Texto **sobre** el botón naranja (≈ 5.9:1, pasa AA; blanco fallaba con 2.76:1) |
| Estados | Verde/ámbar/rojo desaturado, fondo tenue + texto oscuro — como los `.bg-label-*` de GYM-One |

### Opción 2 · Black premium

| Decisión | Valor / criterio |
|---|---|
| Fondo | `#0A0A0B` · superficie `#141415` · elevada `#1B1B1D` · línea `#27272A` |
| Texto | `#F4F4F3` / `#A19E9A` / `#6C6966` |
| Color de acción | **`#FFFFFF`** con texto `#0A0A0B`. No el naranja: sobre negro se vuelve estridente y compite con el contenido |
| Item activo | `rgba(255,255,255,.07)` — presencia por elevación, no por color |
| Estados | Salvia `#7EA98B` · arena `#C4A35A` · terracota `#C7786E`, sobre fondos al 13% |
| Logo | Blanco puro, sin naranja |
| QR de check-in | **Se mantiene oscuro sobre tarjeta blanca** — invertirlo lo haría no escaneable |

### Común a las dos

| | |
|---|---|
| Radios | 8–16px (GYM-One usa 13–18px) |
| Tipografía | IBM Plex Sans (400/500/600/700) + IBM Plex Mono para etiquetas de dato |
| Animación | Solo en el login (entrada de tarjeta + escalonado), con `prefers-reduced-motion` |

**Descartado** de una primera versión oscura anterior: cortes diagonales, glows,
gradientes y la tipografía Crosers. El logo ya aporta la personalidad angular.

---

## Cómo regenerar

Las pantallas con sidebar se generan con scripts para no repetir el shell:

```bash
node _build-socio.mjs    # MisReservas, Explorar, Peso, Perfil, CheckIn
node _build-admin.mjs    # Admin, Cobros, Planes, Sesiones, Marca
node _build-ficha.mjs    # Ficha 1-3
node _build-black.mjs    # deriva las 17 pantallas Black del set claro
node _build-canvas.mjs   # arma canvas.json con las 6 páginas
```

`_gen.mjs` contiene los tokens, el sidebar y los iconos compartidos.
`Main`, `Login`, `MiPlan` y `Agenda` están escritos a mano (no se generan).

`_build-black.mjs` no reescribe pantallas: **remapea los valores del bloque
`:root`** de cada archivo claro, porque todas usan los mismos nombres de token.
Protege el QR del check-in para que siga siendo oscuro sobre blanco (si se
invirtiera dejaría de ser escaneable).

Luego, para sellar el canvas visual:

```bash
node "<base de la skill design>/seed-canvas.mjs"   --template "<base>/payload.template.html"   --out zona-cero-rebrand.html --title "Zona Cero Rebrand"   $(ls *.dc.html | sed 's/^/--artboard /')   --image assets/logo-color.png --image assets/mark-color.png   --image assets/logo-white.png --image assets/mark-white.png   --canvas canvas.json
```

El `.html` resultante (~6 MB, incluye el editor) no se versiona.

### Logos disponibles

| Archivo | Uso |
|---|---|
| `assets/logo-color.png` · `mark-color.png` | Opción 1 (naranja + carbón) |
| `assets/logo-white.png` · `mark-white.png` | Opción 2 (blanco puro, fondo transparente) |
| `assets/logo-black.png` · `mark-black.png` | Monocromo negro, por si se necesita sobre fondo claro |
| `assets/logo-lockup-*.png` | Exports originales sin recortar |

Los monocromos se derivaron del lockup a color forzando todo píxel opaco al
color destino y conservando el canal alfa.

## Pendientes

- **Fuentes de marca perdidas:** `docs/tipografia/` (PDF del imagotipo, `.ai` y
  zip de Crosers) ya no está en el repo — eran archivos sin versionar. Los PNG
  de `assets/` son lo único que quedó; conviene reponer los originales y
  versionarlos.
- **A definir con el cliente:** reglas exactas de acceso por plan (qué plan entra
  a qué disciplina), nombres definitivos de los planes, y si recepción puede
  editar la ficha de un socio o solo consultarla.
- **Elegir opción antes de tocar `app/`:** la app hoy corre un tema oscuro con
  acento coral inventado. Cualquiera de las dos opciones implica remapear los
  tokens de `app/src/index.css`; la Opción 2 es el cambio más corto (ya es
  oscura) y la Opción 1 el más grande. Decisión a confirmar antes de código.
