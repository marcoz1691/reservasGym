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
      --ok-bg:#E8F6EE; --ok-tx:#1E8E5A; --wa-bg:#FDF2DC; --wa-tx:#B7791F;
      --shadow:0 1px 2px rgba(15,23,42,.04), 0 16px 40px -12px rgba(15,23,42,.12);
      --font-sans:'IBM Plex Sans',-apple-system,sans-serif; --font-mono:'IBM Plex Mono',ui-monospace,monospace;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:var(--font-sans); background:var(--bg); color:var(--ink); }
    .mono { font-family:var(--font-mono); }
    .lbl { font-size:12px; font-weight:600; color:var(--ink-2); display:block; margin-bottom:5px; }
    .opt { font-weight:400; color:var(--ink-3); }
    .inp { border-radius:10px; border:1.5px solid var(--line); background:var(--surface-2); padding:10px 12px; font-size:13.5px; color:var(--ink); }
    .inp.ghost { color:var(--ink-3); }
    .btn { border-radius:10px; background:var(--acc); color:var(--acc-contrast); padding:10px 22px; font-size:13px; font-weight:700; display:inline-block; }
    .btn-2 { border-radius:10px; border:1px solid var(--line); padding:10px 18px; font-size:13px; font-weight:600; color:var(--ink-2); display:inline-block; }
    .sec { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3); display:block; margin-bottom:12px; }
    .yn { display:flex; gap:6px; }
    .yn span { border-radius:8px; border:1.5px solid var(--line); background:var(--surface-2); padding:6px 16px; font-size:12.5px; font-weight:600; color:var(--ink-2); }
    .yn span.no { background:var(--surface); border-color:var(--ink-3); color:var(--ink); }
    .yn span.si { background:var(--wa-bg); border-color:var(--wa-tx); color:var(--wa-tx); }
    .chip { display:inline-flex; border-radius:999px; border:1px solid var(--line); background:var(--surface); padding:7px 14px; font-size:12.5px; font-weight:500; color:var(--ink-2); }
    .chip.on { background:var(--acc); border-color:var(--acc); color:var(--acc-contrast); font-weight:700; }
    .cbx { width:17px; height:17px; border-radius:5px; border:1.5px solid var(--line); background:var(--surface-2); flex-shrink:0; }
    .cbx.on { background:var(--acc); border-color:var(--acc); display:flex; align-items:center; justify-content:center; }
  </style>
</helmet>
`

function shell({ step, title, hint, body, h, cta = 'Continuar' }) {
  const pct = Math.round((step / 3) * 100)
  return `${HEAD}
<div style="width:920px; height:${h}px; background:var(--bg); display:flex; align-items:center; justify-content:center;">
  <div style="width:820px; border-radius:16px; border:1px solid var(--line); background:var(--surface); overflow:hidden; box-shadow:var(--shadow);">

    <div style="padding:22px 28px 0;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <div>
          <p class="mono" style="margin:0; font-size:11px; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3);">Paso ${step} de 3</p>
          <h2 style="margin:6px 0 0; font-size:20px; font-weight:700;">${title}</h2>
          <p style="margin:4px 0 0; font-size:12.5px; color:var(--ink-3);">${hint}</p>
        </div>
        <span style="color:var(--ink-3); font-size:20px; line-height:1;">&times;</span>
      </div>
      <div style="margin-top:18px; height:3px; border-radius:999px; background:var(--surface-2); overflow:hidden;">
        <div style="width:${pct}%; height:100%; background:var(--acc); border-radius:999px;"></div>
      </div>
    </div>

    <div style="padding:24px 28px 8px;">
${body}
    </div>

    <div style="display:flex; align-items:center; justify-content:space-between; padding:18px 28px; border-top:1px solid var(--line); margin-top:18px;">
      <span style="font-size:12px; color:var(--ink-3);">Puedes editar todo esto luego desde tu perfil</span>
      <div style="display:flex; gap:8px;">
        ${step > 1 ? '<span class="btn-2">Atrás</span>' : ''}
        <span class="btn">${cta}</span>
      </div>
    </div>
  </div>
</div>
</x-dc>
</body>
</html>
`
}

/* ── PASO 1 · Quién eres ────────────────────────────────────── */
fs.writeFileSync('Ficha.dc.html', shell({
  step: 1, h: 740,
  title: 'Datos del socio',
  hint: 'Lo básico para crear tu ficha y tu credencial de acceso',
  body: `      <div style="display:flex; gap:16px; align-items:center; margin-bottom:22px;">
        <div style="height:60px; width:60px; flex-shrink:0; border-radius:999px; border:1.5px dashed var(--line); background:var(--surface-2); display:flex; align-items:center; justify-content:center; color:var(--ink-3);">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
        </div>
        <div>
          <p style="margin:0; font-size:13px; font-weight:600;">Foto de perfil <span class="opt">— opcional</span></p>
          <p style="margin:3px 0 0; font-size:12px; color:var(--ink-3);">Aparece en tu credencial y en el check-in de recepción.</p>
        </div>
        <span class="btn-2" style="margin-left:auto;">Subir foto</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div><span class="lbl">Nombres y apellidos</span><div class="inp">María Fernanda Íñiguez</div></div>
        <div><span class="lbl">Cédula / pasaporte</span><div class="inp">1723456789</div></div>
        <div><span class="lbl">Fecha de nacimiento</span><div class="inp">15 / 06 / 1995</div></div>
        <div><span class="lbl">Celular</span><div class="inp">+593 98 765 4321</div></div>
        <div><span class="lbl">Correo electrónico</span><div class="inp">maria.iniguez@correo.com</div></div>
        <div><span class="lbl">Ciudad / sector</span><div class="inp">Quito — Pomasqui</div></div>
      </div>

      <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--line);">
        <span class="sec">Contacto de emergencia</span>
        <div style="display:grid; grid-template-columns:1.4fr 1fr 1.2fr; gap:14px;">
          <div><span class="lbl">Nombre completo</span><div class="inp">Luis Íñiguez</div></div>
          <div><span class="lbl">Parentesco</span><div class="inp">Padre</div></div>
          <div><span class="lbl">Celular</span><div class="inp">+593 99 111 2233</div></div>
        </div>
      </div>`,
}))

/* ── PASO 2 · Entrenamiento ─────────────────────────────────── */
fs.writeFileSync('Ficha2.dc.html', shell({
  step: 2, h: 780,
  title: 'Tu entrenamiento',
  hint: 'Nos ayuda a recomendarte clases y a medir tu progreso',
  body: `      <span class="sec">Objetivo principal</span>
      <div style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:24px;">
        <span class="chip">Pérdida de grasa</span>
        <span class="chip">Ganancia muscular</span>
        <span class="chip on">Acondicionamiento Hyrox / CrossFit</span>
        <span class="chip">Fuerza</span>
        <span class="chip">Rendimiento deportivo</span>
        <span class="chip">Salud y bienestar</span>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div>
          <span class="lbl">Nivel de entrenamiento</span>
          <div style="display:flex; gap:6px;">
            <span class="chip" style="flex:1; justify-content:center;">Principiante</span>
            <span class="chip on" style="flex:1; justify-content:center;">Intermedio</span>
            <span class="chip" style="flex:1; justify-content:center;">Avanzado</span>
          </div>
        </div>
        <div>
          <span class="lbl">¿Has entrenado antes en un gimnasio?</span>
          <div class="yn">
            <span class="si" style="flex:1; text-align:center;">Sí</span>
            <span style="flex:1; text-align:center;">No</span>
          </div>
        </div>
        <div><span class="lbl">Días por semana</span><div class="inp">4 días</div></div>
        <div><span class="lbl">Horario habitual</span><div class="inp">Tarde (17:00 – 20:00)</div></div>
      </div>

      <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--line);">
        <span class="sec">Evaluación inicial</span>
        <div style="display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px;">
          <div><span class="lbl">Estatura (cm)</span><div class="inp">172</div></div>
          <div><span class="lbl">Peso (kg)</span><div class="inp">80.2</div></div>
          <div>
            <span class="lbl">IMC</span>
            <div class="inp" style="background:var(--ok-bg); border-color:transparent; color:var(--ok-tx); font-weight:700; display:flex; align-items:center; justify-content:space-between;">
              <span>27.1</span><span style="font-size:11px; font-weight:600;">Sobrepeso</span>
            </div>
          </div>
          <div><span class="lbl">Cintura (cm) <span class="opt">opc.</span></span><div class="inp ghost">—</div></div>
        </div>
        <p style="margin:12px 0 0; font-size:11.5px; color:var(--ink-3); line-height:1.5;">
          El IMC se calcula solo. Si el gimnasio toma tu medición con InBody, recepción puede completar el resto después.
        </p>
      </div>`,
}))

/* ── PASO 3 · Salud y consentimiento ────────────────────────── */
const parq = [
  ['¿Tienes alguna lesión actual o pasada?', 'si', 'Lesión de menisco derecho, operada en 2023. Sin dolor actual.'],
  ['¿Te han hecho alguna cirugía relevante?', 'no', null],
  ['¿Tienes alguna condición médica diagnosticada?', 'no', null],
  ['¿Tomas medicación de forma habitual?', 'no', null],
  ['¿Un médico te ha restringido la actividad física?', 'no', null],
]
fs.writeFileSync('Ficha3.dc.html', shell({
  step: 3, h: 900, cta: 'Crear ficha',
  title: 'Salud y autorizaciones',
  hint: 'Responde con calma: solo se expande lo que marques como "Sí"',
  body: `      <span class="sec">Cuestionario de seguridad</span>
      <div style="display:flex; flex-direction:column; gap:10px;">
${parq.map(([q, ans, detail]) => `        <div style="border-radius:10px; border:1px solid var(--line); background:${ans === 'si' ? 'var(--surface-2)' : 'var(--surface)'}; padding:13px 15px;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:16px;">
            <span style="font-size:13px; font-weight:500;">${q}</span>
            <div class="yn" style="flex-shrink:0;">
              <span class="${ans === 'si' ? 'si' : ''}">Sí</span>
              <span class="${ans === 'no' ? 'no' : ''}">No</span>
            </div>
          </div>${detail ? `
          <div style="margin-top:11px; padding-top:11px; border-top:1px solid var(--line);">
            <span class="lbl">Cuéntanos brevemente</span>
            <div class="inp" style="background:var(--surface);">${detail}</div>
          </div>` : ''}
        </div>`).join('\n')}
      </div>

      <div style="margin-top:14px; border-radius:10px; background:var(--wa-bg); padding:12px 15px; display:flex; gap:10px; align-items:flex-start;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B7791F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px;"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
        <p style="margin:0; font-size:12.5px; color:var(--wa-tx); line-height:1.5;">
          Marcaste una lesión. Recepción te pedirá un certificado médico antes de tu primera sesión de alta intensidad.
        </p>
      </div>

      <div style="margin-top:24px; padding-top:20px; border-top:1px solid var(--line);">
        <span class="sec">Autorizaciones</span>
        <div style="display:flex; flex-direction:column; gap:11px;">
          <div style="display:flex; gap:11px; align-items:flex-start;">
            <div class="cbx on"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#231F20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
            <span style="font-size:13px; line-height:1.45;">Acepto el <strong style="font-weight:600;">reglamento interno</strong> del centro</span>
          </div>
          <div style="display:flex; gap:11px; align-items:flex-start;">
            <div class="cbx on"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#231F20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
            <span style="font-size:13px; line-height:1.45;">Autorizo el <strong style="font-weight:600;">tratamiento de mis datos personales</strong> y declaro que la información es veraz</span>
          </div>
          <div style="display:flex; gap:11px; align-items:flex-start;">
            <div class="cbx on"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#231F20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div>
            <span style="font-size:13px; line-height:1.45;">Doy mi <strong style="font-weight:600;">consentimiento informado</strong> para realizar actividad física</span>
          </div>
          <div style="display:flex; gap:11px; align-items:flex-start;">
            <div class="cbx"></div>
            <span style="font-size:13px; line-height:1.45; color:var(--ink-2);">Autorizo el uso de <strong style="font-weight:600;">fotografías</strong> en redes sociales <span class="opt">— opcional, puedes revocarlo cuando quieras</span></span>
          </div>
        </div>
      </div>`,
}))

console.log('ficha: 3 pasos generados')
