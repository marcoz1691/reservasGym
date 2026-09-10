import { plain } from './_gen-mobile.mjs'

/*
 * En movil la ficha NO es un modal: es un flujo a pantalla completa.
 * Un modal en 390px de ancho es un modal del tamano de la pantalla —
 * el marco solo roba espacio.
 */

function step({ file, n, title, hint, body, cta = 'Continuar' }) {
  plain({
    file,
    body: `  <header style="flex-shrink:0; padding:16px 18px 14px; border-bottom:1px solid var(--line); background:var(--surface);">
    <div class="row" style="margin-bottom:12px;">
      <span style="font-size:22px; color:var(--ink-3); line-height:1;">←</span>
      <p class="mono" style="margin:0; font-size:11px; font-weight:600; letter-spacing:.09em; text-transform:uppercase; color:var(--ink-3);">Paso ${n} de 3</p>
      <span style="font-size:13px; font-weight:600; color:var(--ink-3);">Salir</span>
    </div>
    <div style="height:3px; border-radius:999px; background:var(--surface-2); overflow:hidden;">
      <div style="width:${Math.round((n / 3) * 100)}%; height:100%; background:var(--acc); border-radius:999px;"></div>
    </div>
    <h1 style="margin:14px 0 0; font-size:20px; font-weight:700;">${title}</h1>
    <p style="margin:4px 0 0; font-size:12.5px; color:var(--ink-3); line-height:1.45;">${hint}</p>
  </header>

  <main style="flex:1; min-height:0; overflow:hidden; padding:18px;">
${body}
  </main>

  <div style="flex-shrink:0; padding:14px 18px 20px; border-top:1px solid var(--line); background:var(--surface);">
    <div class="btn">${cta}</div>
  </div>`,
  })
}

/* ── PASO 1 ─────────────────────────────────────────────────── */
step({
  file: 'Ficha.dc.html', n: 1,
  title: 'Datos del socio',
  hint: 'Lo básico para crear tu ficha y tu credencial',
  body: `    <div style="display:flex; align-items:center; gap:14px; margin-bottom:20px;">
      <div style="height:58px; width:58px; flex-shrink:0; border-radius:999px; border:1.5px dashed var(--line); background:var(--surface-2); display:flex; align-items:center; justify-content:center; color:var(--ink-3);">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
      </div>
      <div>
        <p style="margin:0; font-size:13.5px; font-weight:600;">Foto de perfil <span style="font-weight:400; color:var(--ink-3);">— opcional</span></p>
        <p style="margin:3px 0 0; font-size:12px; color:var(--ink-3); line-height:1.4;">Aparece en tu credencial de acceso.</p>
      </div>
    </div>

    <div style="display:flex; flex-direction:column; gap:13px;">
      <div><span class="lbl">Nombres y apellidos</span><div class="inp">María Fernanda Íñiguez</div></div>
      <div style="display:flex; gap:11px;">
        <div style="flex:1;"><span class="lbl">Cédula</span><div class="inp">1723456789</div></div>
        <div style="flex:1;"><span class="lbl">Nacimiento</span><div class="inp">15/06/1995</div></div>
      </div>
      <div><span class="lbl">Celular</span><div class="inp">+593 98 765 4321</div></div>
      <div><span class="lbl">Correo electrónico</span><div class="inp">maria.iniguez@correo.com</div></div>
      <div><span class="lbl">Ciudad / sector</span><div class="inp">Quito — Pomasqui</div></div>
    </div>

    <div style="margin-top:20px; padding-top:17px; border-top:1px solid var(--line);">
      <p class="mono" style="margin:0 0 12px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3);">Contacto de emergencia</p>
      <div style="display:flex; flex-direction:column; gap:13px;">
        <div style="display:flex; gap:11px;">
          <div style="flex:1.5;"><span class="lbl">Nombre</span><div class="inp">Luis Íñiguez</div></div>
          <div style="flex:1;"><span class="lbl">Parentesco</span><div class="inp">Padre</div></div>
        </div>
        <div><span class="lbl">Celular</span><div class="inp">+593 99 111 2233</div></div>
      </div>
    </div>`,
})

/* ── PASO 2 ─────────────────────────────────────────────────── */
step({
  file: 'Ficha2.dc.html', n: 2,
  title: 'Tu entrenamiento',
  hint: 'Para recomendarte clases y medir tu progreso',
  body: `    <p class="mono" style="margin:0 0 11px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3);">Objetivo principal</p>
    <div style="display:flex; gap:7px; flex-wrap:wrap; margin-bottom:20px;">
      <span class="chip" style="font-size:12.5px;">Pérdida de grasa</span>
      <span class="chip on" style="font-size:12.5px;">Hyrox / CrossFit</span>
      <span class="chip" style="font-size:12.5px;">Ganancia muscular</span>
      <span class="chip" style="font-size:12.5px;">Fuerza</span>
      <span class="chip" style="font-size:12.5px;">Salud y bienestar</span>
    </div>

    <p class="mono" style="margin:0 0 11px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3);">Nivel</p>
    <div style="display:flex; gap:7px; margin-bottom:20px;">
      <span class="chip" style="flex:1; justify-content:center;">Principiante</span>
      <span class="chip on" style="flex:1; justify-content:center;">Intermedio</span>
      <span class="chip" style="flex:1; justify-content:center;">Avanzado</span>
    </div>

    <div style="display:flex; gap:11px; margin-bottom:20px;">
      <div style="flex:1;"><span class="lbl">Días por semana</span><div class="inp">4 días</div></div>
      <div style="flex:1;"><span class="lbl">Horario</span><div class="inp">Tarde</div></div>
    </div>

    <div style="padding-top:17px; border-top:1px solid var(--line);">
      <p class="mono" style="margin:0 0 12px; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3);">Evaluación inicial</p>
      <div style="display:flex; gap:11px; margin-bottom:12px;">
        <div style="flex:1;"><span class="lbl">Estatura (cm)</span><div class="inp">172</div></div>
        <div style="flex:1;"><span class="lbl">Peso (kg)</span><div class="inp">80.2</div></div>
      </div>
      <div>
        <span class="lbl">IMC <span style="font-weight:400; color:var(--ink-3);">— se calcula solo</span></span>
        <div class="inp" style="background:var(--wa-bg); border-color:transparent; color:var(--wa-tx); font-weight:700; display:flex; align-items:center; justify-content:space-between;">
          <span>27.1</span><span style="font-size:12.5px; font-weight:600;">Sobrepeso</span>
        </div>
      </div>
    </div>`,
})

/* ── PASO 3 ─────────────────────────────────────────────────── */
const parq = [
  ['¿Tienes alguna lesión actual o pasada?', 'si', 'Menisco derecho, operado en 2023.'],
  ['¿Te han hecho alguna cirugía relevante?', 'no', null],
  ['¿Tienes alguna condición médica?', 'no', null],
  ['¿Tomas medicación habitual?', 'no', null],
  ['¿Un médico te ha restringido el ejercicio?', 'no', null],
]
step({
  file: 'Ficha3.dc.html', n: 3, cta: 'Crear mi ficha',
  title: 'Salud y permisos',
  hint: 'Solo se abre el detalle de lo que marques como "Sí"',
  body: `    <div style="display:flex; flex-direction:column; gap:9px;">
${parq.map(([q, ans, detail]) => `      <div style="border-radius:12px; border:1px solid var(--line); background:${ans === 'si' ? 'var(--surface-2)' : 'var(--surface)'}; padding:12px 13px;">
        <p style="margin:0 0 9px; font-size:13px; font-weight:500; line-height:1.4;">${q}</p>
        <div style="display:flex; gap:7px;">
          <span style="flex:1; text-align:center; border-radius:9px; border:1.5px solid ${ans === 'si' ? 'var(--wa-tx)' : 'var(--line)'}; background:${ans === 'si' ? 'var(--wa-bg)' : 'var(--surface-2)'}; color:${ans === 'si' ? 'var(--wa-tx)' : 'var(--ink-2)'}; padding:8px 0; font-size:13px; font-weight:600;">Sí</span>
          <span style="flex:1; text-align:center; border-radius:9px; border:1.5px solid ${ans === 'no' ? 'var(--ink-3)' : 'var(--line)'}; background:${ans === 'no' ? 'var(--surface)' : 'var(--surface-2)'}; color:${ans === 'no' ? 'var(--ink)' : 'var(--ink-2)'}; padding:8px 0; font-size:13px; font-weight:600;">No</span>
        </div>${detail ? `
        <div style="margin-top:10px;">
          <div class="inp" style="background:var(--surface); font-size:13px;">${detail}</div>
        </div>` : ''}
      </div>`).join('\n')}
    </div>

    <div style="margin-top:12px; border-radius:12px; background:var(--wa-bg); padding:12px 13px; display:flex; gap:9px; align-items:flex-start;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B7791F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px;"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
      <p style="margin:0; font-size:12.5px; color:var(--wa-tx); line-height:1.45;">
        Recepción te pedirá un certificado médico antes de tu primera sesión de alta intensidad.
      </p>
    </div>

    <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:12px;">
      ${[
        ['on', 'Acepto el <strong style="font-weight:600;">reglamento interno</strong>'],
        ['on', 'Autorizo el <strong style="font-weight:600;">tratamiento de mis datos</strong>'],
        ['on', 'Doy mi <strong style="font-weight:600;">consentimiento</strong> para actividad física'],
        ['', 'Autorizo el uso de <strong style="font-weight:600;">fotografías</strong> <span style="color:var(--ink-3);">— opcional</span>'],
      ].map(([on, tx]) => `<div style="display:flex; gap:11px; align-items:flex-start;">
        <div style="width:19px; height:19px; flex-shrink:0; border-radius:6px; border:1.5px solid ${on ? 'var(--acc)' : 'var(--line)'}; background:${on ? 'var(--acc)' : 'var(--surface-2)'}; display:flex; align-items:center; justify-content:center;">
          ${on ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#231F20" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
        </div>
        <span style="font-size:13px; line-height:1.4; color:${on ? 'var(--ink)' : 'var(--ink-2)'};">${tx}</span>
      </div>`).join('\n      ')}
    </div>`,
})

console.log('\n3 pasos de ficha en movil')
