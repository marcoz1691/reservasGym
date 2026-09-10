import fs from 'node:fs'

/*
 * Genera un visor autonomo (un solo .html) con las dos propuestas.
 * Sin dependencias, sin CDN, sin marcas de terceros: se puede abrir
 * localmente o subir a cualquier hosting estatico.
 *
 * Cada pantalla se monta en un <iframe srcdoc> para aislar su CSS
 * (todas declaran :root con los mismos nombres de token y colisionarian
 * si se inyectaran en el mismo documento).
 */

const IMG_FILES = ['logo-color.png', 'mark-color.png', 'logo-white.png', 'mark-white.png']

const images = {}
for (const f of IMG_FILES) {
  images[f] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64')
}

const GROUPS = [
  {
    name: 'Socio',
    screens: [
      ['Login', 'Iniciar sesión', 1280, 820],
      ['Main', 'Inicio', 1440, 940],
      ['Agenda', 'Agenda', 1440, 960],
      ['MisReservas', 'Mis reservas', 1440, 900],
      ['MiPlan', 'Mi plan', 1440, 1180],
      ['Explorar', 'Explorar disciplinas', 1440, 900],
      ['Peso', 'Control de peso', 1440, 980],
      ['Perfil', 'Mi perfil', 1440, 900],
      ['CheckIn', 'Check-in QR', 1100, 820],
    ],
  },
  {
    name: 'Recepción y administración',
    screens: [
      ['Admin', 'Panel general', 1440, 900],
      ['Cobros', 'Cobros y POS', 1440, 960],
      ['Planes', 'Planes de membresía', 1440, 860],
      ['Sesiones', 'Sesiones y clases', 1440, 880],
      ['Marca', 'Marca del gimnasio', 1200, 800],
    ],
  },
  {
    name: 'Ficha de ingreso',
    screens: [
      ['Ficha', 'Paso 1 · Datos del socio', 920, 740],
      ['Ficha2', 'Paso 2 · Entrenamiento', 920, 780],
      ['Ficha3', 'Paso 3 · Salud y permisos', 920, 900],
    ],
  },
]

/* Convierte un .dc.html al HTML plano que entiende un navegador:
   saca el envoltorio del formato de artboards y sube <helmet> al <head>. */
function toPlainHtml(file) {
  let s = fs.readFileSync(file, 'utf8')
  const helmet = (s.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1]
  let body = (s.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ''])[1]
  body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '')
  for (const [name, uri] of Object.entries(images)) {
    body = body.split(`src="${name}"`).join(`src="${uri}"`)
  }
  return `<!doctype html><html><head><meta charset="utf-8">${helmet}
<style>html,body{overflow:hidden}</style></head><body>${body}</body></html>`
}

const data = {}
for (const g of GROUPS) {
  for (const [id] of g.screens) {
    data[id] = toPlainHtml(`${id}.dc.html`)
    data[id + 'Black'] = toPlainHtml(`${id}Black.dc.html`)
  }
}

const nav = GROUPS.map((g) => `
      <div class="group">
        <p class="group-name">${g.name}</p>
        ${g.screens.map(([id, label]) =>
          `<button class="item" data-screen="${id}">${label}</button>`).join('\n        ')}
      </div>`).join('')

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zona Cero Performance Center — Propuesta de diseño</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:#0F0F10; --panel:#17171A; --panel-2:#1E1E22; --line:#2A2A2F;
    --tx:#F2F2F1; --tx-2:#A3A09C; --tx-3:#6E6B68;
    --font:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  }
  * { box-sizing:border-box; }
  html,body { height:100%; }
  body { margin:0; font-family:var(--font); background:var(--bg); color:var(--tx); display:flex; flex-direction:column; }

  header {
    display:flex; align-items:center; justify-content:space-between; gap:20px;
    padding:14px 22px; border-bottom:1px solid var(--line); background:var(--panel); flex-shrink:0;
  }
  .brand { display:flex; align-items:center; gap:11px; min-width:0; }
  .brand img { height:26px; width:auto; display:block; }
  .brand-tx strong { display:block; font-size:14px; font-weight:700; letter-spacing:-.01em; line-height:1.2; }
  .brand-tx span { display:block; font-size:11.5px; color:var(--tx-3); }

  .opts { display:flex; gap:4px; background:var(--panel-2); border:1px solid var(--line); border-radius:999px; padding:4px; }
  .opt {
    border:0; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600;
    padding:7px 16px; border-radius:999px; background:transparent; color:var(--tx-2); transition:.15s;
  }
  .opt:hover { color:var(--tx); }
  .opt.on { background:var(--tx); color:#0F0F10; }

  .zoom { display:flex; align-items:center; gap:8px; font-size:12px; color:var(--tx-3); }
  .zoom button {
    width:28px; height:28px; border-radius:8px; border:1px solid var(--line); background:var(--panel-2);
    color:var(--tx-2); cursor:pointer; font-size:15px; line-height:1; font-family:inherit;
  }
  .zoom button:hover { color:var(--tx); border-color:var(--tx-3); }
  .zoom span { min-width:42px; text-align:center; font-variant-numeric:tabular-nums; }

  main { flex:1; display:flex; min-height:0; }

  nav {
    width:238px; flex-shrink:0; border-right:1px solid var(--line); background:var(--panel);
    overflow-y:auto; padding:16px 12px 24px;
  }
  .group + .group { margin-top:20px; }
  .group-name {
    margin:0 0 7px; padding:0 10px; font-size:10.5px; font-weight:700;
    text-transform:uppercase; letter-spacing:.09em; color:var(--tx-3);
  }
  .item {
    display:block; width:100%; text-align:left; border:0; cursor:pointer; font-family:inherit;
    font-size:13px; font-weight:500; color:var(--tx-2); background:transparent;
    padding:8px 10px; border-radius:8px; transition:.12s;
  }
  .item:hover { background:var(--panel-2); color:var(--tx); }
  .item.on { background:var(--tx); color:#0F0F10; font-weight:600; }

  .stage {
    flex:1; min-width:0; overflow:auto; padding:32px;
    display:flex; align-items:flex-start; justify-content:center;
    background:
      radial-gradient(circle, rgba(255,255,255,.028) 1px, transparent 1.5px) 0 0 / 22px 22px,
      var(--bg);
  }
  .frame-wrap { transform-origin:top center; transition:transform .18s ease-out; }
  .frame {
    border-radius:12px; overflow:hidden; border:1px solid var(--line);
    box-shadow:0 24px 70px -20px rgba(0,0,0,.7); background:#fff; display:block;
  }
  iframe { display:block; border:0; }

  .caption { text-align:center; margin:0 0 14px; font-size:12.5px; color:var(--tx-3); }
  .caption strong { color:var(--tx-2); font-weight:600; }

  @media (max-width:820px) {
    nav { width:100%; position:static; border-right:0; border-bottom:1px solid var(--line);
          max-height:180px; display:flex; gap:16px; overflow-x:auto; }
    main { flex-direction:column; }
    .group + .group { margin-top:0; }
    header { flex-wrap:wrap; }
  }
</style>
</head>
<body>

<header>
  <div class="brand">
    <img id="brandLogo" alt="Zona Cero Performance Center">
    <div class="brand-tx">
      <strong>Zona Cero Performance Center</strong>
      <span>Propuesta de diseño — aplicación de socios y panel interno</span>
    </div>
  </div>

  <div class="opts">
    <button class="opt on" data-opt="light">Opción 1 · Claro</button>
    <button class="opt" data-opt="black">Opción 2 · Negro</button>
  </div>

  <div class="zoom">
    <button id="zOut" title="Reducir">−</button>
    <span id="zVal">75%</span>
    <button id="zIn" title="Ampliar">+</button>
  </div>
</header>

<main>
  <nav>${nav}
  </nav>

  <div class="stage">
    <div>
      <p class="caption"><strong id="capName"></strong> <span id="capSize"></span></p>
      <div class="frame-wrap" id="wrap">
        <div class="frame"><iframe id="view"></iframe></div>
      </div>
    </div>
  </div>
</main>

<script>
const SCREENS = ${JSON.stringify(data)};
const IMAGES = ${JSON.stringify(images)};
const META = ${JSON.stringify(
  Object.fromEntries(GROUPS.flatMap((g) => g.screens.map(([id, label, w, h]) => [id, { label, w, h }])))
)};

let opt = 'light';
let current = 'Login';
let zoom = 0.75;

const view = document.getElementById('view');
const wrap = document.getElementById('wrap');
const zVal = document.getElementById('zVal');

document.getElementById('brandLogo').src = IMAGES['logo-white.png'];

function render() {
  const m = META[current];
  const key = current + (opt === 'black' ? 'Black' : '');
  view.style.width = m.w + 'px';
  view.style.height = m.h + 'px';
  view.srcdoc = SCREENS[key];
  wrap.style.transform = 'scale(' + zoom + ')';
  wrap.style.marginBottom = (m.h * (zoom - 1)) + 'px';
  document.getElementById('capName').textContent = m.label;
  document.getElementById('capSize').textContent = '· ' + m.w + ' × ' + m.h;
  zVal.textContent = Math.round(zoom * 100) + '%';
  document.querySelectorAll('.item').forEach((b) =>
    b.classList.toggle('on', b.dataset.screen === current));
  document.querySelectorAll('.opt').forEach((b) =>
    b.classList.toggle('on', b.dataset.opt === opt));
}

document.querySelectorAll('.item').forEach((b) => {
  b.addEventListener('click', () => { current = b.dataset.screen; render(); });
});
document.querySelectorAll('.opt').forEach((b) => {
  b.addEventListener('click', () => { opt = b.dataset.opt; render(); });
});
document.getElementById('zIn').addEventListener('click', () => {
  zoom = Math.min(1.5, zoom + 0.15); render();
});
document.getElementById('zOut').addEventListener('click', () => {
  zoom = Math.max(0.3, zoom - 0.15); render();
});

/* Flechas para recorrer pantallas, 1 y 2 para cambiar de opcion */
const ORDER = Object.keys(META);
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    current = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]; render(); e.preventDefault();
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    current = ORDER[(ORDER.indexOf(current) - 1 + ORDER.length) % ORDER.length]; render(); e.preventDefault();
  } else if (e.key === '1') { opt = 'light'; render(); }
  else if (e.key === '2') { opt = 'black'; render(); }
});

render();
</script>
</body>
</html>
`

fs.writeFileSync('index.html', html)
const kb = Math.round(html.length / 1024)
console.log(`index.html — ${kb} KB · ${Object.keys(data).length} pantallas · sin dependencias externas`)
