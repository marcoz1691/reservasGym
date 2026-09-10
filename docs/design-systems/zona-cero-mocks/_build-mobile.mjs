import { mobile, plain } from './_gen-mobile.mjs'

/* ── LOGIN ──────────────────────────────────────────────────── */
plain({
  file: 'Login.dc.html',
  body: `  <div style="flex:1; display:flex; flex-direction:column; justify-content:center; padding:24px; background:
    radial-gradient(circle, rgba(28,25,23,.05) 1px, transparent 1.6px) 0 0 / 22px 22px, var(--bg);">

    <div style="text-align:center; margin-bottom:28px;">
      <img src="logo-color.png" alt="Zona Cero" style="height:54px; width:auto; margin:0 auto 18px; display:block;" />
      <h1 style="margin:0; font-size:21px; font-weight:700;">Iniciar sesión</h1>
      <p style="margin:5px 0 0; font-size:13px; color:var(--ink-3);">Zona Cero Performance Center</p>
    </div>

    <div style="margin-bottom:16px;">
      <span class="lbl">Correo electrónico</span>
      <div class="inp">socio@gym.local</div>
    </div>

    <div style="margin-bottom:10px;">
      <span class="lbl">Contraseña</span>
      <div class="inp" style="letter-spacing:.2em;">••••••••</div>
    </div>

    <div style="text-align:right; margin-bottom:22px;">
      <span style="font-size:13px; font-weight:600; color:var(--acc);">¿Olvidaste tu contraseña?</span>
    </div>

    <div class="btn">Entrar</div>

    <div style="text-align:center; margin-top:18px; font-size:13.5px; color:var(--ink-3);">
      ¿No tienes cuenta? <span style="color:var(--acc); font-weight:600;">Crear cuenta</span>
    </div>

    <div style="margin-top:28px; padding-top:20px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:center; gap:9px;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11c0-2 1.5-3.5 3.5-3.5S19 9 19 11c0 4-2 7-3 8"/><path d="M5 11a7 7 0 0 1 12-5"/><path d="M8.5 11c0-2 1.5-3.5 3.5-3.5"/><path d="M12 11v3c0 2-.5 4-1.5 5.5"/><path d="M5 15c0 2 .5 3.5 1 4.5"/></svg>
      <span style="font-size:13px; font-weight:600; color:var(--ink-2);">Entrar con huella</span>
    </div>
  </div>`,
})

/* ── INICIO ─────────────────────────────────────────────────── */
mobile({
  file: 'Main.dc.html', title: 'Zona Cero', tab: 'inicio',
  body: `    <p class="mono" style="margin:0; font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; color:var(--ink-3);">Jueves 5 de septiembre</p>
    <h1 style="margin:4px 0 16px; font-size:22px; font-weight:700;">Buenas tardes, Ana</h1>

    <div class="card" style="padding:16px; margin-bottom:14px;">
      <div class="mono" style="font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:var(--acc);">Tu próxima clase</div>
      <p style="margin:7px 0 0; font-size:17px; font-weight:700;">CrossFit — fuerza</p>
      <p style="margin:4px 0 0; font-size:13px; color:var(--ink-2);">Hoy · 19:00 <span style="color:var(--ink-3);">— en 4 horas</span></p>
      <div class="btn" style="margin-top:14px; padding:12px;">Ver mi reserva</div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:9px; margin-bottom:16px;">
      <div class="card" style="padding:12px 10px; text-align:center;">
        <p style="margin:0; font-size:21px; font-weight:700;">2</p>
        <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3); line-height:1.3;">Reservas</p>
      </div>
      <div class="card" style="padding:12px 10px; text-align:center;">
        <p style="margin:0; font-size:21px; font-weight:700;">9</p>
        <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3); line-height:1.3;">Áreas</p>
      </div>
      <div class="card" style="padding:12px 10px; text-align:center;">
        <p style="margin:0; font-size:21px; font-weight:700;">78.4</p>
        <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3); line-height:1.3;">kg</p>
      </div>
    </div>

    <div class="row" style="margin-bottom:10px;">
      <h2 style="margin:0; font-size:15px; font-weight:700;">Próximas sesiones</h2>
      <span style="font-size:12.5px; font-weight:600; color:var(--acc);">Ver agenda</span>
    </div>

    <div style="display:flex; flex-direction:column; gap:9px;">
      <div class="card" style="padding:13px 14px;">
        <div class="row">
          <div>
            <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">Dragon Fit</p>
            <p style="margin:3px 0 0; font-size:14.5px; font-weight:600;">Sesión grupal</p>
            <p style="margin:2px 0 0; font-size:12.5px; color:var(--ink-3);">Hoy · 17:00</p>
          </div>
          <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">6/20</span>
        </div>
      </div>
      <div class="card" style="padding:13px 14px;">
        <div class="row">
          <div>
            <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">Gimnasio</p>
            <p style="margin:3px 0 0; font-size:14.5px; font-weight:600;">Acceso libre</p>
            <p style="margin:2px 0 0; font-size:12.5px; color:var(--ink-3);">Hoy · 18:00</p>
          </div>
          <span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">24/30</span>
        </div>
      </div>
      <div class="card" style="padding:13px 14px;">
        <div class="row">
          <div>
            <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">Musculación</p>
            <p style="margin:3px 0 0; font-size:14.5px; font-weight:600;">Acceso libre</p>
            <p style="margin:2px 0 0; font-size:12.5px; color:var(--ink-3);">Mañana · 08:00</p>
          </div>
          <span class="pill" style="background:var(--da-bg); color:var(--da-tx);">25/25</span>
        </div>
      </div>
    </div>`,
})

/* ── AGENDA ─────────────────────────────────────────────────── */
mobile({
  file: 'Agenda.dc.html', title: 'Agenda', tab: 'agenda',
  body: `    <div style="display:flex; gap:7px; overflow:hidden; margin-bottom:14px;">
      <span class="chip on">Todas</span>
      <span class="chip">CrossFit</span>
      <span class="chip">Hyrox</span>
      <span class="chip">Gimnasio</span>
    </div>

    <div class="card" style="padding:10px 8px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between;">
        ${[['Lun', '8'], ['Mar', '9'], ['Mié', '10'], ['Jue', '11'], ['Vie', '12'], ['Sáb', '13']]
          .map(([d, n], i) => `<div style="flex:1; text-align:center; padding:7px 0; border-radius:10px; ${i === 1 ? 'background:var(--acc); color:var(--acc-contrast);' : 'color:var(--ink-2);'}">
          <p class="mono" style="margin:0; font-size:9.5px; text-transform:uppercase; opacity:.75;">${d}</p>
          <p style="margin:2px 0 0; font-size:15px; font-weight:700;">${n}</p>
        </div>`).join('\n        ')}
      </div>
    </div>

    <p class="mono" style="margin:0 0 10px; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.1em; color:var(--ink-3);">Martes 9 · 4 sesiones</p>

    <div style="display:flex; flex-direction:column; gap:9px;">
      <div class="card" style="padding:13px 14px;">
        <div class="row">
          <div style="display:flex; gap:12px; align-items:center;">
            <p class="mono" style="margin:0; font-size:13px; font-weight:600; color:var(--ink-2);">07:00</p>
            <div>
              <p style="margin:0; font-size:14.5px; font-weight:600;">Musculación</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--ink-3);">Acceso libre</p>
            </div>
          </div>
          <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">12/25</span>
        </div>
      </div>

      <div class="card" style="padding:13px 14px; border-color:var(--acc); border-width:1.5px;">
        <div class="row">
          <div style="display:flex; gap:12px; align-items:center;">
            <p class="mono" style="margin:0; font-size:13px; font-weight:700;">19:00</p>
            <div>
              <p style="margin:0; font-size:14.5px; font-weight:700;">CrossFit</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--ink-3);">Diego M. · 60 min</p>
            </div>
          </div>
          <span class="pill" style="background:var(--acc-soft); color:var(--acc-contrast);">Reservado</span>
        </div>
        <div style="margin-top:12px; padding-top:11px; border-top:1px solid var(--line); display:flex; gap:8px;">
          <div class="btn-2" style="flex:1; padding:10px;">Cancelar</div>
          <div class="btn-2" style="flex:1; padding:10px;">Reagendar</div>
        </div>
      </div>

      <div class="card" style="padding:13px 14px;">
        <div class="row">
          <div style="display:flex; gap:12px; align-items:center;">
            <p class="mono" style="margin:0; font-size:13px; font-weight:600; color:var(--ink-2);">19:00</p>
            <div>
              <p style="margin:0; font-size:14.5px; font-weight:600;">Hyrox</p>
              <p style="margin:2px 0 0; font-size:12px; color:var(--ink-3);">Preparación</p>
            </div>
          </div>
          <span class="pill" style="background:var(--da-bg); color:var(--da-tx);">Lleno</span>
        </div>
        <div class="btn-2" style="margin-top:11px; padding:10px;">Unirme a la lista de espera</div>
      </div>
    </div>`,
})

/* ── MIS RESERVAS ───────────────────────────────────────────── */
mobile({
  file: 'MisReservas.dc.html', title: 'Mis reservas', tab: 'reservas',
  body: `    <div style="display:flex; gap:7px; margin-bottom:14px;">
      <span class="chip on">Próximas 2</span>
      <span class="chip">En espera 1</span>
      <span class="chip">Historial</span>
    </div>

    <div style="display:flex; flex-direction:column; gap:11px;">

      <div class="card" style="padding:15px;">
        <div class="row" style="align-items:flex-start;">
          <div style="display:flex; gap:13px;">
            <div style="text-align:center; padding-right:13px; border-right:1px solid var(--line);">
              <p class="mono" style="margin:0; font-size:10px; color:var(--ink-3); text-transform:uppercase;">Mar</p>
              <p style="margin:1px 0 0; font-size:20px; font-weight:700; line-height:1;">9</p>
              <p class="mono" style="margin:2px 0 0; font-size:10px; color:var(--ink-3);">SEP</p>
            </div>
            <div>
              <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">CrossFit</p>
              <p style="margin:3px 0 0; font-size:15px; font-weight:700;">Sesión de fuerza</p>
              <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">19:00 · Diego M.</p>
            </div>
          </div>
          <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Confirmada</span>
        </div>
        <div class="btn" style="margin-top:13px; padding:12px;">Mostrar QR de check-in</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <div class="btn-2" style="flex:1; padding:10px;">Cancelar</div>
          <div class="btn-2" style="flex:1; padding:10px;">Reagendar</div>
        </div>
      </div>

      <div class="card" style="padding:15px;">
        <div class="row" style="align-items:flex-start;">
          <div style="display:flex; gap:13px;">
            <div style="text-align:center; padding-right:13px; border-right:1px solid var(--line);">
              <p class="mono" style="margin:0; font-size:10px; color:var(--ink-3); text-transform:uppercase;">Jue</p>
              <p style="margin:1px 0 0; font-size:20px; font-weight:700; line-height:1;">11</p>
              <p class="mono" style="margin:2px 0 0; font-size:10px; color:var(--ink-3);">SEP</p>
            </div>
            <div>
              <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">Dragon Fit</p>
              <p style="margin:3px 0 0; font-size:15px; font-weight:700;">Sesión grupal</p>
              <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">17:00 · Karla V.</p>
            </div>
          </div>
          <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Confirmada</span>
        </div>
      </div>

      <div class="card" style="padding:15px; border-style:dashed;">
        <div class="row" style="align-items:flex-start;">
          <div style="display:flex; gap:13px;">
            <div style="text-align:center; padding-right:13px; border-right:1px solid var(--line);">
              <p class="mono" style="margin:0; font-size:10px; color:var(--ink-3); text-transform:uppercase;">Vie</p>
              <p style="margin:1px 0 0; font-size:20px; font-weight:700; line-height:1;">12</p>
              <p class="mono" style="margin:2px 0 0; font-size:10px; color:var(--ink-3);">SEP</p>
            </div>
            <div>
              <p class="mono" style="margin:0; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-3);">Hyrox</p>
              <p style="margin:3px 0 0; font-size:15px; font-weight:700;">Preparación</p>
              <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">Posición <strong style="color:var(--ink);">2</strong> en la lista</p>
            </div>
          </div>
          <span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">En espera</span>
        </div>
      </div>
    </div>`,
})

/* ── MI PLAN ────────────────────────────────────────────────── */
mobile({
  file: 'MiPlan.dc.html', title: 'Mi plan', tab: 'plan',
  body: `    <div class="card" style="padding:18px; border-top:3px solid var(--acc); margin-bottom:13px;">
      <div class="row" style="align-items:flex-start;">
        <div>
          <div class="mono" style="font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--ink-3);">Zona Cero Performance</div>
          <h2 style="margin:6px 0 0; font-size:19px; font-weight:700;">Plan Mensual<br/>Ilimitado</h2>
        </div>
        <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Activa</span>
      </div>

      <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line);">
        <div class="row" style="font-size:12.5px; margin-bottom:8px;">
          <span style="font-weight:600; color:var(--ink-2);">Tiempo de vigencia</span>
          <span style="font-weight:700;">20 días</span>
        </div>
        <div style="height:7px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); overflow:hidden;">
          <div style="width:67%; height:100%; background:var(--acc);"></div>
        </div>
        <p style="margin:9px 0 0; font-size:12.5px; color:var(--ink-3);">Vence el 25 de septiembre de 2026</p>
      </div>

      <div style="margin-top:14px; padding-top:13px; border-top:1px solid var(--line); display:flex; gap:14px;">
        <div>
          <span class="eyebrow">Valor</span>
          <p style="margin:3px 0 0; font-size:15px; font-weight:700;">$45.00</p>
        </div>
        <div>
          <span class="eyebrow">Acceso</span>
          <p style="margin:3px 0 0; font-size:15px; font-weight:700;">Todas las áreas</p>
        </div>
      </div>
    </div>

    <div class="card" style="padding:16px; margin-bottom:13px;">
      <h3 style="margin:0; font-size:15px; font-weight:700;">Renueva en recepción</h3>
      <p style="margin:6px 0 12px; font-size:12.5px; color:var(--ink-2); line-height:1.5;">
        Acércate al counter para renovar. Aceptamos:
      </p>
      <div style="display:flex; gap:7px; flex-wrap:wrap;">
        <span class="chip" style="padding:7px 12px; font-size:12px;">Efectivo</span>
        <span class="chip" style="padding:7px 12px; font-size:12px;">Transferencia</span>
        <span class="chip" style="padding:7px 12px; font-size:12px;">Datafast POS</span>
      </div>
    </div>

    <div class="row" style="margin-bottom:9px;">
      <h3 style="margin:0; font-size:15px; font-weight:700;">Otros planes</h3>
      <span style="font-size:12.5px; font-weight:600; color:var(--acc);">Ver todos</span>
    </div>
    <div style="display:flex; gap:9px;">
      <div class="card" style="flex:1; padding:13px;">
        <p style="margin:0; font-size:12.5px; font-weight:600;">Trimestral</p>
        <p style="margin:6px 0 0; font-size:17px; font-weight:700;">$120</p>
        <p style="margin:1px 0 0; font-size:11px; color:var(--ink-3);">90 días</p>
      </div>
      <div class="card" style="flex:1; padding:13px;">
        <p style="margin:0; font-size:12.5px; font-weight:600;">10 Visitas</p>
        <p style="margin:6px 0 0; font-size:17px; font-weight:700;">$35</p>
        <p style="margin:1px 0 0; font-size:11px; color:var(--ink-3);">60 días</p>
      </div>
    </div>`,
})

/* ── EXPLORAR ───────────────────────────────────────────────── */
const zonas = [
  ['Gimnasio', 'Máquinas y cardio', 'ok', '12/30'],
  ['CrossFit', 'Clases dirigidas', 'ok', '11/18'],
  ['Hyrox', 'Preparación', 'da', '16/16'],
  ['Musculación', 'Peso libre y racks', 'wa', '21/25'],
  ['Dragon Fit', 'Funcional grupal', 'ok', '6/20'],
  ['Bailoterapia', 'Ritmos', 'ok', '9/20'],
]
mobile({
  file: 'Explorar.dc.html', title: 'Explorar', tab: 'inicio',
  body: `    <div style="display:flex; gap:7px; overflow:hidden; margin-bottom:14px;">
      <span class="chip on">Todas</span>
      <span class="chip">En mi plan</span>
      <span class="chip">Con cupo</span>
    </div>

    <div style="display:flex; flex-direction:column; gap:9px;">
${zonas.map(([n, d, tone, cap]) => `      <div class="card" style="padding:14px;">
        <div class="row">
          <div>
            <p style="margin:0; font-size:15px; font-weight:700;">${n}</p>
            <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-3);">${d}</p>
          </div>
          <div style="text-align:right;">
            <span class="pill" style="background:var(--${tone}-bg); color:var(--${tone}-tx);">${cap}</span>
            <p style="margin:5px 0 0; font-size:10.5px; color:var(--ink-3);">hoy</p>
          </div>
        </div>
      </div>`).join('\n')}
    </div>`,
})

/* ── CONTROL DE PESO ────────────────────────────────────────── */
mobile({
  file: 'Peso.dc.html', title: 'Control de peso', tab: 'peso',
  body: `    <div class="card" style="padding:18px; margin-bottom:13px;">
      <span class="eyebrow">Peso actual</span>
      <div class="row" style="margin-top:5px; align-items:flex-end;">
        <p style="margin:0; font-size:34px; font-weight:700; line-height:1;">78.4 <span style="font-size:16px; font-weight:500; color:var(--ink-3);">kg</span></p>
        <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">−1.8 kg</span>
      </div>

      <svg viewBox="0 0 320 90" style="width:100%; height:90px; display:block; margin-top:16px;">
        <line x1="0" y1="20" x2="320" y2="20" stroke="#E7E4DF" stroke-width="1"/>
        <line x1="0" y1="50" x2="320" y2="50" stroke="#E7E4DF" stroke-width="1"/>
        <line x1="0" y1="80" x2="320" y2="80" stroke="#E7E4DF" stroke-width="1"/>
        <path d="M12,26 L64,34 L116,31 L168,49 L220,56 L272,61 L308,66" fill="none" stroke="#F26D17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="26" r="3" fill="#F26D17"/><circle cx="116" cy="31" r="3" fill="#F26D17"/>
        <circle cx="220" cy="56" r="3" fill="#F26D17"/>
        <circle cx="308" cy="66" r="4.5" fill="#F26D17" stroke="#fff" stroke-width="2"/>
      </svg>
      <div class="mono" style="display:flex; justify-content:space-between; font-size:10px; color:var(--ink-3); margin-top:4px;">
        <span>Mar</span><span>May</span><span>Jul</span><span>Sep</span>
      </div>
    </div>

    <div style="display:flex; gap:11px; margin-bottom:13px;">
      <div class="card" style="flex:1; padding:15px;">
        <span class="eyebrow">IMC</span>
        <p style="margin:5px 0 0; font-size:24px; font-weight:700; line-height:1;">24.2</p>
        <span class="pill" style="display:inline-block; margin-top:7px; background:var(--ok-bg); color:var(--ok-tx);">Normal</span>
      </div>
      <div class="card" style="flex:1; padding:15px;">
        <span class="eyebrow">Objetivo</span>
        <p style="margin:5px 0 0; font-size:24px; font-weight:700; line-height:1;">75.0</p>
        <p style="margin:7px 0 0; font-size:11px; color:var(--ink-3);">Faltan 3.4 kg</p>
      </div>
    </div>

    <div class="btn" style="margin-bottom:13px;">Registrar nueva medida</div>

    <div class="card" style="overflow:hidden;">
      <div style="padding:13px 15px; border-bottom:1px solid var(--line);">
        <p style="margin:0; font-size:14px; font-weight:700;">Últimas medidas</p>
      </div>
      ${[['05 sep', '78.4 kg', '24.2'], ['22 ago', '79.1 kg', '24.4'], ['08 ago', '79.6 kg', '24.6']]
        .map(([f, p, i], idx) => `<div class="row" style="padding:12px 15px; ${idx < 2 ? 'border-bottom:1px solid var(--line);' : ''}">
        <span class="mono" style="font-size:12.5px; color:var(--ink-3);">${f}</span>
        <span style="font-size:13.5px; font-weight:600;">${p}</span>
        <span style="font-size:12.5px; color:var(--ink-2);">IMC ${i}</span>
      </div>`).join('\n      ')}
    </div>`,
})

/* ── PERFIL ─────────────────────────────────────────────────── */
mobile({
  file: 'Perfil.dc.html', title: 'Mi perfil', tab: 'inicio',
  body: `    <div class="card" style="padding:20px; text-align:center; margin-bottom:13px;">
      <div style="height:76px; width:76px; margin:0 auto; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:23px; font-weight:700; color:var(--ink-2);">AS</div>
      <p style="margin:12px 0 0; font-size:17px; font-weight:700;">Ana Sofía Socio</p>
      <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-3);">socio@gym.local</p>
      <span class="pill" style="display:inline-block; margin-top:9px; background:var(--ok-bg); color:var(--ok-tx);">Socio activo · Nº 0142</span>
    </div>

    <div class="card" style="padding:16px; margin-bottom:13px;">
      <div class="row" style="margin-bottom:13px;">
        <p style="margin:0; font-size:14.5px; font-weight:700;">Ficha técnica</p>
        <span style="font-size:12.5px; font-weight:600; color:var(--acc);">Editar</span>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
        <div><span class="eyebrow">Estatura</span><p style="margin:3px 0 0; font-size:15px; font-weight:700;">1.72 m</p></div>
        <div><span class="eyebrow">IMC actual</span><p style="margin:3px 0 0; font-size:15px; font-weight:700;">24.2</p></div>
        <div><span class="eyebrow">Nivel</span><p style="margin:3px 0 0; font-size:15px; font-weight:700;">Intermedio</p></div>
        <div><span class="eyebrow">Nacimiento</span><p style="margin:3px 0 0; font-size:15px; font-weight:700;">15 jun 1995</p></div>
      </div>
      <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line);">
        <span class="eyebrow">Objetivo</span>
        <p style="margin:4px 0 0; font-size:13.5px;">Acondicionamiento Hyrox / CrossFit</p>
      </div>
    </div>

    <div class="card" style="padding:15px 16px; margin-bottom:11px;">
      <div class="row">
        <div>
          <p style="margin:0; font-size:14px; font-weight:600;">Ingreso con huella</p>
          <p style="margin:2px 0 0; font-size:12px; color:var(--ink-3);">Entra sin escribir la contraseña</p>
        </div>
        <div style="width:44px; height:26px; border-radius:999px; background:var(--acc); position:relative; flex-shrink:0;">
          <div style="position:absolute; right:3px; top:3px; width:20px; height:20px; border-radius:999px; background:#fff;"></div>
        </div>
      </div>
    </div>

    <div class="btn-2">Cerrar sesión</div>`,
})

/* ── CHECK-IN QR ────────────────────────────────────────────── */
mobile({
  file: 'CheckIn.dc.html', title: 'Check-in', tab: 'reservas',
  body: `    <div class="card" style="padding:20px; text-align:center;">
      <p class="mono" style="margin:0; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.09em; color:var(--ink-3);">CrossFit · Sesión de fuerza</p>
      <p style="margin:6px 0 0; font-size:16px; font-weight:700;">Hoy · 19:00</p>

      <div style="margin:18px auto 0; width:194px; height:194px; border-radius:12px; border:1px solid var(--line); background:#fff; display:flex; align-items:center; justify-content:center;">
        <svg width="164" height="164" viewBox="0 0 29 29" shape-rendering="crispEdges">
          <rect width="29" height="29" fill="#fff"/>
          <g fill="#1C1917">
            <rect x="1" y="1" width="7" height="7"/><rect x="2" y="2" width="5" height="5" fill="#fff"/><rect x="3" y="3" width="3" height="3"/>
            <rect x="21" y="1" width="7" height="7"/><rect x="22" y="2" width="5" height="5" fill="#fff"/><rect x="23" y="3" width="3" height="3"/>
            <rect x="1" y="21" width="7" height="7"/><rect x="2" y="22" width="5" height="5" fill="#fff"/><rect x="3" y="23" width="3" height="3"/>
            <rect x="10" y="1" width="1" height="1"/><rect x="12" y="1" width="2" height="1"/><rect x="16" y="1" width="1" height="1"/>
            <rect x="11" y="3" width="1" height="2"/><rect x="14" y="2" width="1" height="3"/><rect x="17" y="3" width="2" height="1"/>
            <rect x="10" y="6" width="3" height="1"/><rect x="15" y="5" width="1" height="2"/><rect x="18" y="6" width="1" height="1"/>
            <rect x="1" y="10" width="1" height="1"/><rect x="3" y="10" width="2" height="1"/><rect x="6" y="10" width="1" height="2"/>
            <rect x="2" y="12" width="1" height="2"/><rect x="4" y="13" width="2" height="1"/><rect x="1" y="16" width="1" height="2"/>
            <rect x="5" y="16" width="2" height="1"/><rect x="3" y="18" width="1" height="1"/>
            <rect x="10" y="9" width="2" height="2"/><rect x="13" y="10" width="1" height="1"/><rect x="15" y="9" width="1" height="2"/>
            <rect x="17" y="10" width="2" height="1"/><rect x="11" y="12" width="1" height="2"/><rect x="14" y="13" width="2" height="1"/>
            <rect x="18" y="12" width="1" height="2"/><rect x="10" y="15" width="1" height="1"/><rect x="13" y="15" width="2" height="2"/>
            <rect x="17" y="16" width="1" height="1"/><rect x="11" y="18" width="2" height="1"/><rect x="16" y="18" width="2" height="1"/>
            <rect x="21" y="10" width="1" height="2"/><rect x="24" y="10" width="2" height="1"/><rect x="27" y="11" width="1" height="1"/>
            <rect x="22" y="13" width="2" height="1"/><rect x="26" y="13" width="1" height="2"/><rect x="21" y="16" width="1" height="1"/>
            <rect x="24" y="16" width="1" height="2"/><rect x="27" y="17" width="1" height="1"/>
            <rect x="10" y="21" width="1" height="2"/><rect x="13" y="21" width="2" height="1"/><rect x="17" y="21" width="1" height="1"/>
            <rect x="11" y="24" width="2" height="1"/><rect x="15" y="23" width="1" height="2"/><rect x="18" y="24" width="1" height="1"/>
            <rect x="10" y="26" width="2" height="1"/><rect x="14" y="26" width="1" height="1"/><rect x="17" y="26" width="2" height="1"/>
            <rect x="21" y="21" width="2" height="1"/><rect x="25" y="21" width="1" height="2"/><rect x="21" y="24" width="1" height="2"/>
            <rect x="24" y="24" width="2" height="1"/><rect x="27" y="25" width="1" height="1"/><rect x="23" y="27" width="2" height="1"/>
          </g>
        </svg>
      </div>

      <p class="mono" style="margin:14px 0 0; font-size:12px; letter-spacing:.14em; color:var(--ink-2);">ZC-0142-7391</p>
      <p style="margin:9px 0 0; font-size:12.5px; color:var(--ink-3); line-height:1.5;">
        Se activa <strong style="color:var(--ink-2);">20 min antes</strong> y expira al terminar la clase.
      </p>

      <div style="margin-top:14px; padding-top:13px; border-top:1px solid var(--line); display:flex; justify-content:center; gap:7px;">
        <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Membresía activa</span>
        <span class="pill" style="background:var(--surface-2); color:var(--ink-2);">Acceso permitido</span>
      </div>
    </div>

    <p style="margin:16px 0 0; text-align:center; font-size:12.5px; color:var(--ink-3);">
      Muestra este código en recepción
    </p>`,
})

console.log('\n9 pantallas de socio en movil')
