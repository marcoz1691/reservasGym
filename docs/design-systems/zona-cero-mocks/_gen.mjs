import fs from 'node:fs'

const HEAD = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:#F6F5F2; --surface:#FFFFFF; --surface-2:#FAFAF8; --line:#E7E4DF;
      --ink:#1C1917; --ink-2:#6B6560; --ink-3:#9C9690;
      --acc:#F26D17; --acc-contrast:#231F20; --acc-soft:rgba(242,109,23,.10);
      --ok-bg:#E8F6EE; --ok-tx:#1E8E5A; --wa-bg:#FDF2DC; --wa-tx:#B7791F; --da-bg:#FBEAEA; --da-tx:#D64545;
      --shadow:0 1px 2px rgba(15,23,42,.04), 0 10px 28px -10px rgba(15,23,42,.10);
      --font-sans:'IBM Plex Sans',-apple-system,sans-serif; --font-mono:'IBM Plex Mono',ui-monospace,monospace;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--font-sans); background:var(--bg); color:var(--ink); }
    .mono { font-family:var(--font-mono); }
    .nav { display:flex; align-items:center; gap:10px; border-radius:8px; padding:9px 10px; color:var(--ink-2); font-size:14px; font-weight:500; }
    .nav.on { background:var(--acc-soft); color:var(--acc-contrast); font-weight:700; }
    .card { border-radius:14px; border:1px solid var(--line); background:var(--surface); box-shadow:var(--shadow); }
    .pill { border-radius:999px; padding:3px 9px; font-size:11px; font-weight:700; }
    .chip { display:inline-flex; align-items:center; border-radius:999px; border:1px solid var(--line); background:var(--surface); padding:6px 13px; font-size:12.5px; font-weight:500; color:var(--ink-2); }
    .chip.on { background:var(--acc); border-color:var(--acc); color:var(--acc-contrast); font-weight:700; }
    .btn { border-radius:10px; background:var(--acc); color:var(--acc-contrast); padding:9px 18px; font-size:13px; font-weight:700; display:inline-block; }
    .btn-2 { border-radius:10px; border:1px solid var(--line); padding:9px 16px; font-size:13px; font-weight:600; color:var(--ink-2); display:inline-block; }
    .lbl { font-size:12px; font-weight:600; color:var(--ink-2); display:block; margin-bottom:5px; }
    .inp { border-radius:10px; border:1.5px solid var(--line); background:var(--surface-2); padding:10px 12px; font-size:13.5px; color:var(--ink); }
    .eyebrow { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3); }
    th { text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--ink-3); padding:10px 14px; border-bottom:1px solid var(--line); }
    td { padding:12px 14px; font-size:13px; border-bottom:1px solid var(--line); }
  </style>
</helmet>
`

const ICONS = {
  inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  agenda: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3"/>',
  reservas: '<path d="M4 8h11l4 4-4 4H4z"/>',
  plan: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  peso: '<path d="M3 17l6-6 4 4 7-8"/><path d="M15 7h5v5"/>',
  explorar: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  admin: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  cobros: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  planes: '<path d="M4 5h16M4 12h16M4 19h16"/>',
  sesiones: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 3v3M16 3v3M9 14h6"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM19 19h2v2h-2z"/>',
  marca: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18"/>',
}

const svg = (k) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`

const MEMBER_NAV = [
  ['inicio', 'Inicio'], ['agenda', 'Agenda'], ['reservas', 'Mis Reservas'], ['plan', 'Mi Plan'],
  ['peso', 'Control de Peso'], ['explorar', 'Explorar Áreas'], ['perfil', 'Mi Perfil'],
]
const STAFF_NAV = [
  ['admin', 'Panel'], ['cobros', 'Cobros POS'], ['planes', 'Planes'], ['sesiones', 'Sesiones'],
  ['qr', 'Check-in'], ['agenda', 'Agenda'], ['marca', 'Marca'],
]

function sidebar(active, role) {
  const items = role === 'staff' ? STAFF_NAV : MEMBER_NAV
  const user = role === 'staff'
    ? ['RC', 'Recepción', 'Staff']
    : ['AS', 'Ana Socio', 'Socio activo']
  const links = items.map(([k, label]) =>
    `        <div class="nav${k === active ? ' on' : ''}">${svg(k)}${label}</div>`).join('\n')
  return `  <aside style="width:240px; flex-shrink:0; border-right:1px solid var(--line); background:var(--surface); padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
    <div style="display:flex; flex-direction:column; gap:20px;">
      <div style="display:flex; align-items:center; gap:9px; padding:4px 4px 12px; border-bottom:1px solid var(--line);">
        <img src="mark-color.png" alt="Zona Cero" style="height:24px; width:auto; display:block;" />
        <div style="font-size:14px; font-weight:700; letter-spacing:-.01em;">Zona Cero</div>
      </div>
      <nav style="display:flex; flex-direction:column; gap:2px;">
${links}
      </nav>
    </div>
    <div style="display:flex; align-items:center; gap:10px; padding:12px 6px 0; border-top:1px solid var(--line);">
      <div style="display:flex; height:32px; width:32px; align-items:center; justify-content:center; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); font-size:11px; font-weight:700; color:var(--ink-2);">${user[0]}</div>
      <div><p style="margin:0; font-size:12px; font-weight:600;">${user[1]}</p><p style="margin:0; font-size:11px; color:var(--ink-3);">${user[2]}</p></div>
    </div>
  </aside>`
}

export function build({ file, w, h, active, role = 'member', body }) {
  const html = `${HEAD}
<div style="width:${w}px; height:${h}px; background:var(--bg); display:flex; overflow:hidden;">

${sidebar(active, role)}

  <main style="flex:1; min-width:0; padding:32px 40px; display:flex; flex-direction:column; gap:18px;">
${body}
  </main>
</div>
</x-dc>
</body>
</html>
`
  fs.writeFileSync(file, html)
  console.log('escrito', file, html.length, 'chars')
}
