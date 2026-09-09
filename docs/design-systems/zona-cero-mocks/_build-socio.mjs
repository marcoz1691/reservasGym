import { build } from './_gen.mjs'

const H = (t, s) => `    <div>
      <h1 style="margin:0; font-size:24px; font-weight:700;">${t}</h1>
      <p style="margin:5px 0 0; font-size:13px; color:var(--ink-3);">${s}</p>
    </div>`

/* ── MIS RESERVAS ───────────────────────────────────────────── */
build({
  file: 'MisReservas.dc.html', w: 1440, h: 900, active: 'reservas',
  body: `${H('Mis reservas', 'Cancelar, reagendar y mostrar tu QR de check-in')}

    <div style="display:flex; gap:7px;">
      <span class="chip on">Próximas (2)</span>
      <span class="chip">Historial</span>
      <span class="chip">Lista de espera (1)</span>
    </div>

    <div class="card" style="padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px;">
      <div style="display:flex; align-items:center; gap:18px;">
        <div style="text-align:center; border-right:1px solid var(--line); padding-right:18px;">
          <p class="mono" style="margin:0; font-size:10.5px; color:var(--ink-3); text-transform:uppercase;">Mar</p>
          <p style="margin:1px 0 0; font-size:22px; font-weight:700; line-height:1;">9</p>
          <p class="mono" style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">SEP</p>
        </div>
        <div>
          <p class="eyebrow" style="margin:0;">CrossFit · Instructor Diego M.</p>
          <p style="margin:4px 0 0; font-size:16px; font-weight:700;">Sesión de fuerza</p>
          <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">19:00 – 20:00 · quedan 7 cupos</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Confirmada</span>
        <span class="btn-2">Cancelar</span>
        <span class="btn-2">Reagendar</span>
        <span class="btn">Ver QR</span>
      </div>
    </div>

    <div class="card" style="padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px;">
      <div style="display:flex; align-items:center; gap:18px;">
        <div style="text-align:center; border-right:1px solid var(--line); padding-right:18px;">
          <p class="mono" style="margin:0; font-size:10.5px; color:var(--ink-3); text-transform:uppercase;">Jue</p>
          <p style="margin:1px 0 0; font-size:22px; font-weight:700; line-height:1;">11</p>
          <p class="mono" style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">SEP</p>
        </div>
        <div>
          <p class="eyebrow" style="margin:0;">Dragon Fit</p>
          <p style="margin:4px 0 0; font-size:16px; font-weight:700;">Sesión grupal</p>
          <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">17:00 – 18:00 · quedan 14 cupos</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Confirmada</span>
        <span class="btn-2">Cancelar</span>
        <span class="btn-2">Reagendar</span>
        <span class="btn">Ver QR</span>
      </div>
    </div>

    <div class="card" style="padding:18px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px; border-style:dashed;">
      <div style="display:flex; align-items:center; gap:18px;">
        <div style="text-align:center; border-right:1px solid var(--line); padding-right:18px;">
          <p class="mono" style="margin:0; font-size:10.5px; color:var(--ink-3); text-transform:uppercase;">Vie</p>
          <p style="margin:1px 0 0; font-size:22px; font-weight:700; line-height:1;">12</p>
          <p class="mono" style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">SEP</p>
        </div>
        <div>
          <p class="eyebrow" style="margin:0;">Hyrox</p>
          <p style="margin:4px 0 0; font-size:16px; font-weight:700;">Preparación competencia</p>
          <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-2);">Estás en posición <strong style="color:var(--ink);">2</strong> de la lista · te avisamos si se libera un cupo</p>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">Lista de espera</span>
        <span class="btn-2">Salir de la lista</span>
      </div>
    </div>`,
})

/* ── EXPLORAR ÁREAS ─────────────────────────────────────────── */
const zonas = [
  ['Gimnasio', 'Acceso libre a máquinas y cardio', '30', 'Todos los planes'],
  ['CrossFit', 'Clases dirigidas por instructor', '18', 'Gold · Silver'],
  ['Hyrox', 'Preparación y competencia', '16', 'Gold · Silver'],
  ['Musculación', 'Peso libre y racks', '25', 'Todos los planes'],
  ['Dragon Fit', 'Entrenamiento funcional grupal', '20', 'Gold'],
  ['Bailoterapia', 'Ritmos y acondicionamiento', '20', 'Gold'],
  ['Fisioterapia', 'Sesiones individuales con cita', '4', 'Gold'],
  ['Nutrición', 'Consulta y plan alimenticio', '2', 'Gold'],
  ['Áreas comunes', 'Vestidores, lockers y descanso', '—', 'Todos los planes'],
]
build({
  file: 'Explorar.dc.html', w: 1440, h: 900, active: 'explorar',
  body: `${H('Explorar disciplinas', 'Las 9 disciplinas de Zona Cero Performance Center')}

    <div style="display:flex; gap:7px; flex-wrap:wrap;">
      <span class="chip on">Todas</span>
      <span class="chip">Incluidas en mi plan</span>
      <span class="chip">Con cupo hoy</span>
    </div>

    <div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px;">
${zonas.map(([n, d, cap, planes]) => `      <div class="card" style="padding:18px 20px;">
        <p style="margin:0; font-size:15px; font-weight:700;">${n}</p>
        <p style="margin:5px 0 0; font-size:12.5px; color:var(--ink-2); line-height:1.5;">${d}</p>
        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
          <div>
            <p class="mono" style="margin:0; font-size:10px; color:var(--ink-3); text-transform:uppercase;">Aforo</p>
            <p style="margin:1px 0 0; font-size:13px; font-weight:600;">${cap}</p>
          </div>
          <div style="text-align:right;">
            <p class="mono" style="margin:0; font-size:10px; color:var(--ink-3); text-transform:uppercase;">Acceso</p>
            <p style="margin:1px 0 0; font-size:12px; font-weight:600;">${planes}</p>
          </div>
        </div>
      </div>`).join('\n')}
    </div>`,
})

/* ── CONTROL DE PESO ────────────────────────────────────────── */
build({
  file: 'Peso.dc.html', w: 1440, h: 980, active: 'peso',
  body: `${H('Control de peso', 'Progreso antropométrico, IMC e historial de medidas')}

    <div style="display:grid; grid-template-columns:1.4fr 1fr; gap:14px;">
      <div class="card" style="padding:22px 24px;">
        <div style="display:flex; align-items:flex-end; justify-content:space-between;">
          <div>
            <p class="eyebrow" style="margin:0;">Peso actual</p>
            <p style="margin:6px 0 0; font-size:38px; font-weight:700; line-height:1;">78.4 <span style="font-size:18px; font-weight:500; color:var(--ink-3);">kg</span></p>
            <p style="margin:6px 0 0; font-size:12.5px; color:var(--ok-tx); font-weight:600;">−1.8 kg desde tu registro inicial</p>
          </div>
          <span class="btn">Registrar medida</span>
        </div>

        <!-- Gráfica de progreso -->
        <div style="margin-top:24px;">
          <svg viewBox="0 0 560 150" style="width:100%; height:150px; display:block;">
            <line x1="0" y1="30" x2="560" y2="30" stroke="#E7E4DF" stroke-width="1"/>
            <line x1="0" y1="70" x2="560" y2="70" stroke="#E7E4DF" stroke-width="1"/>
            <line x1="0" y1="110" x2="560" y2="110" stroke="#E7E4DF" stroke-width="1"/>
            <path d="M20,42 L110,55 L200,50 L290,78 L380,88 L470,96 L540,104" fill="none" stroke="#F26D17" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="20" cy="42" r="3.5" fill="#F26D17"/>
            <circle cx="110" cy="55" r="3.5" fill="#F26D17"/>
            <circle cx="200" cy="50" r="3.5" fill="#F26D17"/>
            <circle cx="290" cy="78" r="3.5" fill="#F26D17"/>
            <circle cx="380" cy="88" r="3.5" fill="#F26D17"/>
            <circle cx="470" cy="96" r="3.5" fill="#F26D17"/>
            <circle cx="540" cy="104" r="4.5" fill="#F26D17" stroke="#fff" stroke-width="2"/>
          </svg>
          <div class="mono" style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--ink-3); margin-top:6px;">
            <span>Mar</span><span>Abr</span><span>May</span><span>Jun</span><span>Jul</span><span>Ago</span><span>Sep</span>
          </div>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card" style="padding:20px 22px;">
          <p class="eyebrow" style="margin:0;">Índice de masa corporal</p>
          <p style="margin:6px 0 0; font-size:30px; font-weight:700; line-height:1;">24.2</p>
          <span class="pill" style="display:inline-block; margin-top:8px; background:var(--ok-bg); color:var(--ok-tx);">Peso normal</span>
          <div style="margin-top:14px; display:flex; height:6px; border-radius:999px; overflow:hidden;">
            <div style="flex:2; background:#CFE6F5;"></div>
            <div style="flex:3; background:#9FDCBB;"></div>
            <div style="flex:3; background:#F5D79B;"></div>
            <div style="flex:2; background:#F2B3B3;"></div>
          </div>
          <div class="mono" style="display:flex; justify-content:space-between; font-size:9.5px; color:var(--ink-3); margin-top:5px;">
            <span>18.5</span><span>25.0</span><span>30.0</span><span>35+</span>
          </div>
        </div>
        <div class="card" style="padding:20px 22px;">
          <p class="eyebrow" style="margin:0;">Objetivo</p>
          <p style="margin:6px 0 0; font-size:15px; font-weight:600;">Llegar a 75.0 kg</p>
          <div style="margin-top:10px; height:6px; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); overflow:hidden;">
            <div style="width:54%; height:100%; background:var(--acc);"></div>
          </div>
          <p style="margin:8px 0 0; font-size:12px; color:var(--ink-3);">Faltan 3.4 kg · 54% del camino</p>
        </div>
      </div>
    </div>

    <div class="card" style="overflow:hidden;">
      <div style="padding:16px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
        <p style="margin:0; font-size:15px; font-weight:700;">Historial de medidas</p>
        <span style="font-size:12px; font-weight:600; color:var(--acc);">Exportar</span>
      </div>
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr><th>Fecha</th><th>Peso</th><th>IMC</th><th>Cintura</th><th>Cadera</th><th>Registrado por</th></tr></thead>
        <tbody>
          <tr><td class="mono">05 sep 2026</td><td style="font-weight:600;">78.4 kg</td><td>24.2</td><td>84 cm</td><td>98 cm</td><td style="color:var(--ink-3);">Ana Socio</td></tr>
          <tr><td class="mono">22 ago 2026</td><td style="font-weight:600;">79.1 kg</td><td>24.4</td><td>85 cm</td><td>98 cm</td><td style="color:var(--ink-3);">Recepción</td></tr>
          <tr><td class="mono">08 ago 2026</td><td style="font-weight:600;">79.6 kg</td><td>24.6</td><td>86 cm</td><td>99 cm</td><td style="color:var(--ink-3);">Ana Socio</td></tr>
          <tr><td class="mono">18 jul 2026</td><td style="font-weight:600;">80.2 kg</td><td>24.8</td><td>87 cm</td><td>99 cm</td><td style="color:var(--ink-3);">Recepción</td></tr>
        </tbody>
      </table>
    </div>`,
})

/* ── MI PERFIL ──────────────────────────────────────────────── */
build({
  file: 'Perfil.dc.html', w: 1440, h: 900, active: 'perfil',
  body: `${H('Mi perfil', 'Datos de cuenta, ficha antropométrica y seguridad')}

    <div style="display:grid; grid-template-columns:1fr 1.6fr; gap:14px;">
      <div class="card" style="padding:24px; text-align:center;">
        <div style="height:88px; width:88px; margin:0 auto; border-radius:999px; background:var(--surface-2); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; color:var(--ink-2);">AS</div>
        <p style="margin:14px 0 0; font-size:17px; font-weight:700;">Ana Sofía Socio</p>
        <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-3);">socio@gym.local</p>
        <span class="pill" style="display:inline-block; margin-top:10px; background:var(--ok-bg); color:var(--ok-tx);">Socio activo · Nº 0142</span>
        <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line); display:flex; flex-direction:column; gap:8px;">
          <span class="btn-2" style="text-align:center;">Cambiar foto</span>
          <span class="btn-2" style="text-align:center;">Cambiar contraseña</span>
        </div>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card" style="padding:22px 24px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <p style="margin:0; font-size:15px; font-weight:700;">Datos personales</p>
            <span style="font-size:12px; font-weight:600; color:var(--acc);">Editar</span>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
            <div><span class="eyebrow">Cédula</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">1723456789</p></div>
            <div><span class="eyebrow">Fecha de nacimiento</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">15 jun 1995 · 31 años</p></div>
            <div><span class="eyebrow">Celular</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">+593 98 765 4321</p></div>
            <div><span class="eyebrow">Ciudad / sector</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">Quito — Pomasqui</p></div>
            <div><span class="eyebrow">Contacto de emergencia</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">Luis Íñiguez (padre)</p></div>
            <div><span class="eyebrow">Celular de emergencia</span><p style="margin:3px 0 0; font-size:13.5px; font-weight:500;">+593 99 111 2233</p></div>
          </div>
        </div>

        <div class="card" style="padding:22px 24px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <p style="margin:0; font-size:15px; font-weight:700;">Ficha técnica</p>
            <span style="font-size:12px; font-weight:600; color:var(--acc);">Ver ficha completa</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:16px;">
            <div><span class="eyebrow">Estatura</span><p style="margin:3px 0 0; font-size:16px; font-weight:700;">1.72 m</p></div>
            <div><span class="eyebrow">Peso inicial</span><p style="margin:3px 0 0; font-size:16px; font-weight:700;">80.2 kg</p></div>
            <div><span class="eyebrow">IMC actual</span><p style="margin:3px 0 0; font-size:16px; font-weight:700;">24.2</p></div>
            <div><span class="eyebrow">Nivel</span><p style="margin:3px 0 0; font-size:16px; font-weight:700;">Intermedio</p></div>
          </div>
          <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line);">
            <span class="eyebrow">Objetivo principal</span>
            <p style="margin:4px 0 0; font-size:13.5px;">Acondicionamiento Hyrox / CrossFit</p>
          </div>
        </div>

        <div class="card" style="padding:20px 24px; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <p style="margin:0; font-size:14px; font-weight:700;">Ingreso con huella / Face ID</p>
            <p style="margin:3px 0 0; font-size:12.5px; color:var(--ink-3);">Entra sin escribir tu contraseña en este dispositivo</p>
          </div>
          <div style="width:44px; height:25px; border-radius:999px; background:var(--acc); position:relative;">
            <div style="position:absolute; right:3px; top:3px; width:19px; height:19px; border-radius:999px; background:#fff;"></div>
          </div>
        </div>
      </div>
    </div>`,
})

/* ── CHECK-IN QR (socio) ────────────────────────────────────── */
build({
  file: 'CheckIn.dc.html', w: 1100, h: 820, active: 'reservas',
  body: `${H('Check-in', 'Muestra este código en recepción para registrar tu asistencia')}

    <div style="display:flex; justify-content:center; padding-top:8px;">
      <div class="card" style="width:400px; padding:28px; text-align:center;">
        <p class="eyebrow" style="margin:0;">CrossFit · Sesión de fuerza</p>
        <p style="margin:6px 0 0; font-size:17px; font-weight:700;">Martes 9 sep · 19:00</p>

        <div style="margin:22px auto 0; width:210px; height:210px; border-radius:12px; border:1px solid var(--line); background:#fff; display:flex; align-items:center; justify-content:center;">
          <svg width="170" height="170" viewBox="0 0 29 29" shape-rendering="crispEdges">
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

        <p class="mono" style="margin:16px 0 0; font-size:12px; letter-spacing:.14em; color:var(--ink-2);">ZC-0142-7391</p>
        <p style="margin:10px 0 0; font-size:12.5px; color:var(--ink-3); line-height:1.5;">
          El código se activa <strong style="color:var(--ink-2);">20 minutos antes</strong> de la clase y expira al terminar.
        </p>
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:center; gap:8px;">
          <span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Membresía activa</span>
          <span class="pill" style="background:var(--surface-2); color:var(--ink-2);">Acceso permitido</span>
        </div>
      </div>
    </div>`,
})
