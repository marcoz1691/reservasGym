# Zona Cero — Maquetas de la app (minimalista)

Maquetas visuales de **todas** las pantallas de la app, fusionando la marca real
de Zona Cero Performance Center con el patrón minimalista del login de
**GYM-One** (el sistema que el cliente ya usa). Son maquetas estáticas para
revisión — no un prototipo clicable ni el código de la app.

**Ver publicado:** https://claude.ai/code/artifact/a4dac558-5871-4ae9-9ada-296b5b55a489

El canvas está dividido en 3 páginas: **Socio**, **Staff / Admin** y
**Ficha de ingreso**.

---

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

Referencia: `GYM-One/login/index.php` y `GYM-One/assets/css/dashboard.css`.

| Decisión | Valor / criterio |
|---|---|
| Fondo | `#F6F5F2` — neutro cálido claro (GYM-One usa `#f4f6fb`; se entibia para acompañar al naranja) |
| Superficie | `#FFFFFF`, borde `1px #E7E4DF`, sombra suave |
| Radios | 8–16px (GYM-One usa 13–18px) |
| Tipografía | IBM Plex Sans (400/500/600/700) + IBM Plex Mono para etiquetas de dato |
| Acento `#F26D17` | Muestreado en píxel del imagotipo. **Solo** en botón primario, item activo, borde del plan actual y links |
| Carbón `#231F20` | Texto **sobre** el botón naranja (≈ 5.9:1, pasa AA; blanco fallaba con 2.76:1) |
| Estados | Verde/ámbar/rojo desaturado, fondo tenue + texto oscuro — como los `.bg-label-*` de GYM-One |
| Animación | Solo en el login (entrada de tarjeta + escalonado), con `prefers-reduced-motion` |

**Descartado** de una primera versión oscura: cortes diagonales, glows,
gradientes y la tipografía Crosers. El logo ya aporta la personalidad angular.

---

## Cómo regenerar

Las pantallas con sidebar se generan con scripts para no repetir el shell:

```bash
node _build-socio.mjs    # MisReservas, Explorar, Peso, Perfil, CheckIn
node _build-admin.mjs    # Admin, Cobros, Planes, Sesiones, Marca
node _build-ficha.mjs    # Ficha 1-3
```

`_gen.mjs` contiene los tokens, el sidebar y los iconos compartidos.
`Main`, `Login`, `MiPlan` y `Agenda` están escritos a mano (no se generan).

Luego, para sellar el canvas visual:

```bash
node "<base de la skill design>/seed-canvas.mjs" \
  --template "<base>/payload.template.html" \
  --out zona-cero-rebrand.html --title "Zona Cero Rebrand" \
  $(ls *.dc.html | sed 's/^/--artboard /') \
  --image assets/logo-color.png --image assets/mark-color.png \
  --canvas canvas.json
```

El `.html` resultante (~3 MB, incluye el editor) no se versiona.

---

## Pendientes

- **Fuentes de marca perdidas:** `docs/tipografia/` (PDF del imagotipo, `.ai` y
  zip de Crosers) ya no está en el repo — eran archivos sin versionar. Los PNG
  de `assets/` son lo único que quedó; conviene reponer los originales y
  versionarlos.
- **A definir con el cliente:** reglas exactas de acceso por plan (qué plan entra
  a qué disciplina), nombres definitivos de los planes, y si recepción puede
  editar la ficha de un socio o solo consultarla.
- **Aplicar a `app/`:** la app hoy corre tema **oscuro**. Adoptar esta dirección
  clara implica remapear los tokens de `app/src/index.css` — decisión a confirmar
  antes de tocar código.
