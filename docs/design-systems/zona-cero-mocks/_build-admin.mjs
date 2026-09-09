import { build } from './_gen.mjs'

const H = (t, s) => `    <div>
      <h1 style="margin:0; font-size:24px; font-weight:700;">${t}</h1>
      <p style="margin:5px 0 0; font-size:13px; color:var(--ink-3);">${s}</p>
    </div>`

const stat = (l, v, sub = '') => `      <div class="card" style="padding:16px 18px;">
        <p class="eyebrow" style="margin:0;">${l}</p>
        <p style="margin:8px 0 0; font-size:26px; font-weight:700; line-height:1;">${v}</p>
        ${sub ? `<p style="margin:5px 0 0; font-size:11.5px; color:var(--ink-3);">${sub}</p>` : ''}
      </div>`

/* ── PANEL ADMIN ────────────────────────────────────────────── */
build({
  file: 'Admin.dc.html', w: 1440, h: 900, active: 'admin', role: 'staff',
  body: `${H('Panel de administración', 'Ocupación del día, cobros y estado de membresías')}

    <div style="display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px;">
${stat('Sesiones hoy', '12', '3 en curso')}
${stat('Reservas activas', '87', '+9 vs. ayer')}
${stat('Cobrado hoy', '$385.00', '7 transacciones')}
${stat('Por vencer (7 días)', '14', 'socios a contactar')}
    </div>

    <div style="display:grid; grid-template-columns:1.5fr 1fr; gap:14px;">
      <div class="card" style="overflow:hidden;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
          <p style="margin:0; font-size:15px; font-weight:700;">Ocupación de hoy</p>
          <span style="font-size:12px; font-weight:600; color:var(--acc);">Ver agenda</span>
        </div>
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr><th>Hora</th><th>Disciplina</th><th>Instructor</th><th>Aforo</th><th></th></tr></thead>
          <tbody>
            <tr><td class="mono">07:00</td><td style="font-weight:600;">Musculación</td><td style="color:var(--ink-3);">—</td><td>12/25</td><td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Disponible</span></td></tr>
            <tr><td class="mono">17:00</td><td style="font-weight:600;">Dragon Fit</td><td style="color:var(--ink-3);">Karla V.</td><td>6/20</td><td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Disponible</span></td></tr>
            <tr><td class="mono">18:00</td><td style="font-weight:600;">Gimnasio</td><td style="color:var(--ink-3);">—</td><td>24/30</td><td><span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">Casi lleno</span></td></tr>
            <tr><td class="mono">19:00</td><td style="font-weight:600;">CrossFit</td><td style="color:var(--ink-3);">Diego M.</td><td>11/18</td><td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Disponible</span></td></tr>
            <tr><td class="mono">19:00</td><td style="font-weight:600;">Hyrox</td><td style="color:var(--ink-3);">Diego M.</td><td>16/16</td><td><span class="pill" style="background:var(--da-bg); color:var(--da-tx);">Lleno · 2 en espera</span></td></tr>
          </tbody>
        </table>
      </div>

      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card" style="padding:20px 22px;">
          <p style="margin:0 0 14px; font-size:15px; font-weight:700;">Acciones rápidas</p>
          <div style="display:flex; flex-direction:column; gap:8px;">
            <span class="btn" style="text-align:center;">Cobrar membresía</span>
            <span class="btn-2" style="text-align:center;">Escanear check-in</span>
            <span class="btn-2" style="text-align:center;">Reservar por un socio</span>
            <span class="btn-2" style="text-align:center;">Crear sesión</span>
          </div>
        </div>
        <div class="card" style="padding:20px 22px;">
          <p style="margin:0 0 12px; font-size:15px; font-weight:700;">Estado de membresías</p>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:13px; color:var(--ink-2);">Activas</span><span style="font-size:14px; font-weight:700;">142</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:13px; color:var(--ink-2);">En gracia</span><span style="font-size:14px; font-weight:700; color:var(--wa-tx);">6</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-size:13px; color:var(--ink-2);">Vencidas</span><span style="font-size:14px; font-weight:700; color:var(--da-tx);">23</span>
            </div>
          </div>
        </div>
      </div>
    </div>`,
})

/* ── COBROS POS ─────────────────────────────────────────────── */
build({
  file: 'Cobros.dc.html', w: 1440, h: 960, active: 'cobros', role: 'staff',
  body: `${H('Cobros y POS', 'Cobros presenciales en caja, renovaciones y control de vencidos')}

    <div style="display:grid; grid-template-columns:1fr 1.1fr; gap:14px;">

      <!-- Buscar socio y cobrar -->
      <div class="card" style="padding:22px 24px;">
        <p style="margin:0 0 14px; font-size:15px; font-weight:700;">Registrar cobro</p>

        <span class="lbl">Buscar socio</span>
        <div class="inp" style="display:flex; align-items:center; gap:8px; color:var(--ink-3);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          Nombre, cédula o correo…
        </div>

        <!-- Socio seleccionado -->
        <div style="margin-top:12px; border-radius:10px; border:1.5px solid var(--acc); background:var(--surface-2); padding:14px;">
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:11px;">
              <div style="height:36px; width:36px; border-radius:999px; background:var(--surface); border:1px solid var(--line); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:var(--ink-2);">AS</div>
              <div>
                <p style="margin:0; font-size:13.5px; font-weight:700;">Ana Sofía Socio</p>
                <p class="mono" style="margin:1px 0 0; font-size:11px; color:var(--ink-3);">1723456789 · Nº 0142</p>
              </div>
            </div>
            <span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">Vence en 3 días</span>
          </div>
        </div>

        <div style="margin-top:16px;">
          <span class="lbl">Plan a cobrar</span>
          <div class="inp" style="display:flex; align-items:center; justify-content:space-between;">
            <span>Plan Mensual Ilimitado — 30 días</span>
            <span style="font-weight:700;">$45.00</span>
          </div>
        </div>

        <div style="margin-top:16px;">
          <span class="lbl">Método de pago</span>
          <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px;">
            <div style="border-radius:10px; border:1.5px solid var(--acc); background:var(--acc-soft); padding:11px 8px; text-align:center;">
              <p style="margin:0; font-size:12.5px; font-weight:700;">Datafast POS</p>
              <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">Débito / crédito</p>
            </div>
            <div style="border-radius:10px; border:1.5px solid var(--line); background:var(--surface-2); padding:11px 8px; text-align:center;">
              <p style="margin:0; font-size:12.5px; font-weight:600;">Efectivo</p>
              <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">En caja</p>
            </div>
            <div style="border-radius:10px; border:1.5px solid var(--line); background:var(--surface-2); padding:11px 8px; text-align:center;">
              <p style="margin:0; font-size:12.5px; font-weight:600;">Transferencia</p>
              <p style="margin:2px 0 0; font-size:10.5px; color:var(--ink-3);">Bancos locales</p>
            </div>
          </div>
        </div>

        <div style="margin-top:18px; padding-top:16px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
          <div>
            <p class="eyebrow" style="margin:0;">Total a cobrar</p>
            <p style="margin:3px 0 0; font-size:26px; font-weight:700; line-height:1;">$45.00</p>
          </div>
          <span class="btn" style="padding:12px 26px; font-size:14px;">Registrar cobro</span>
        </div>
        <p style="margin:10px 0 0; font-size:11.5px; color:var(--ink-3); line-height:1.5;">
          Al registrar, la membresía se extiende automáticamente 30 días desde hoy.
        </p>
      </div>

      <!-- Vencidos y últimos cobros -->
      <div style="display:flex; flex-direction:column; gap:14px;">
        <div class="card" style="overflow:hidden;">
          <div style="padding:16px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
            <p style="margin:0; font-size:15px; font-weight:700;">Por vencer y vencidos</p>
            <div style="display:flex; gap:6px;">
              <span class="chip on" style="padding:4px 10px; font-size:11.5px;">Todos</span>
              <span class="chip" style="padding:4px 10px; font-size:11.5px;">En gracia</span>
              <span class="chip" style="padding:4px 10px; font-size:11.5px;">Vencidos</span>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>Socio</th><th>Plan</th><th>Vence</th><th>Estado</th></tr></thead>
            <tbody>
              <tr><td style="font-weight:600;">Ana Sofía Socio</td><td style="color:var(--ink-3);">Mensual</td><td class="mono">12 sep</td><td><span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">En 3 días</span></td></tr>
              <tr><td style="font-weight:600;">Luis Ramírez</td><td style="color:var(--ink-3);">Trimestral</td><td class="mono">07 sep</td><td><span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">En gracia</span></td></tr>
              <tr><td style="font-weight:600;">Carla Mejía</td><td style="color:var(--ink-3);">Mensual</td><td class="mono">31 ago</td><td><span class="pill" style="background:var(--da-bg); color:var(--da-tx);">Vencida</span></td></tr>
              <tr><td style="font-weight:600;">Jorge Paredes</td><td style="color:var(--ink-3);">10 visitas</td><td class="mono">28 ago</td><td><span class="pill" style="background:var(--da-bg); color:var(--da-tx);">Vencida</span></td></tr>
            </tbody>
          </table>
        </div>

        <div class="card" style="overflow:hidden;">
          <div style="padding:16px 20px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
            <p style="margin:0; font-size:15px; font-weight:700;">Cobros de hoy</p>
            <span style="font-size:13px; font-weight:700;">$385.00</span>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <thead><tr><th>Hora</th><th>Socio</th><th>Método</th><th>Monto</th></tr></thead>
            <tbody>
              <tr><td class="mono">11:42</td><td style="font-weight:600;">Karla Suárez</td><td style="color:var(--ink-3);">Datafast POS</td><td style="font-weight:600;">$45.00</td></tr>
              <tr><td class="mono">10:15</td><td style="font-weight:600;">Andrés Nieto</td><td style="color:var(--ink-3);">Efectivo</td><td style="font-weight:600;">$120.00</td></tr>
              <tr><td class="mono">09:30</td><td style="font-weight:600;">Paola Ruiz</td><td style="color:var(--ink-3);">Transferencia</td><td style="font-weight:600;">$45.00</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>`,
})

/* ── PLANES ─────────────────────────────────────────────────── */
build({
  file: 'Planes.dc.html', w: 1440, h: 860, active: 'planes', role: 'staff',
  body: `    <div style="display:flex; align-items:flex-start; justify-content:space-between;">
      ${H('Planes de membresía', 'Tarifas en USD, duraciones y acceso por disciplina').trim()}
      <span class="btn">Nuevo plan</span>
    </div>

    <div class="card" style="overflow:hidden;">
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr><th>Plan</th><th>Precio</th><th>Duración</th><th>Visitas</th><th>Acceso a disciplinas</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr>
            <td style="font-weight:700;">Plan Mensual Ilimitado</td>
            <td style="font-weight:600;">$45.00</td><td>30 días</td><td style="color:var(--ink-3);">Ilimitadas</td>
            <td style="color:var(--ink-2);">Todas las disciplinas</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Activo</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Plan Trimestral</td>
            <td style="font-weight:600;">$120.00</td><td>90 días</td><td style="color:var(--ink-3);">Ilimitadas</td>
            <td style="color:var(--ink-2);">Todas las disciplinas</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Activo</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Pase 10 Visitas</td>
            <td style="font-weight:600;">$35.00</td><td>60 días</td><td style="color:var(--ink-3);">10</td>
            <td style="color:var(--ink-2);">Gimnasio · Musculación</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">Activo</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td style="font-weight:700;">Plan Estudiante</td>
            <td style="font-weight:600;">$32.00</td><td>30 días</td><td style="color:var(--ink-3);">Ilimitadas</td>
            <td style="color:var(--ink-2);">Gimnasio · Musculación · CrossFit</td>
            <td><span class="pill" style="background:var(--surface-2); color:var(--ink-2);">Inactivo</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Editor de plan -->
    <div class="card" style="padding:22px 24px;">
      <p style="margin:0 0 16px; font-size:15px; font-weight:700;">Editar · Pase 10 Visitas</p>
      <div style="display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:14px;">
        <div><span class="lbl">Nombre del plan</span><div class="inp">Pase 10 Visitas</div></div>
        <div><span class="lbl">Precio (USD)</span><div class="inp">35.00</div></div>
        <div><span class="lbl">Duración (días)</span><div class="inp">60</div></div>
        <div><span class="lbl">Cupo de visitas</span><div class="inp">10</div></div>
      </div>

      <div style="margin-top:18px;">
        <span class="lbl">Disciplinas incluidas</span>
        <div style="display:flex; gap:7px; flex-wrap:wrap;">
          <span class="chip on">Gimnasio</span>
          <span class="chip on">Musculación</span>
          <span class="chip">CrossFit</span>
          <span class="chip">Hyrox</span>
          <span class="chip">Dragon Fit</span>
          <span class="chip">Bailoterapia</span>
          <span class="chip">Fisioterapia</span>
          <span class="chip">Nutrición</span>
          <span class="chip">Áreas comunes</span>
        </div>
      </div>

      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:40px; height:23px; border-radius:999px; background:var(--acc); position:relative;">
            <div style="position:absolute; right:3px; top:3px; width:17px; height:17px; border-radius:999px; background:#fff;"></div>
          </div>
          <span style="font-size:13px; font-weight:500; color:var(--ink-2);">Disponible para venta en caja y POS</span>
        </div>
        <div style="display:flex; gap:8px;">
          <span class="btn-2">Cancelar</span>
          <span class="btn">Guardar plan</span>
        </div>
      </div>
    </div>`,
})

/* ── SESIONES ───────────────────────────────────────────────── */
build({
  file: 'Sesiones.dc.html', w: 1440, h: 880, active: 'sesiones', role: 'staff',
  body: `    <div style="display:flex; align-items:flex-start; justify-content:space-between;">
      ${H('Sesiones y clases', 'Horarios, instructores y cupos — editable sin tocar código').trim()}
      <span class="btn">Nueva sesión</span>
    </div>

    <div style="display:flex; gap:7px; flex-wrap:wrap;">
      <span class="chip on">Esta semana</span>
      <span class="chip">Todas las disciplinas</span>
      <span class="chip">Clase grupal</span>
      <span class="chip">Acceso libre</span>
      <span class="chip">Preparación / competencia</span>
    </div>

    <div class="card" style="overflow:hidden;">
      <table style="width:100%; border-collapse:collapse;">
        <thead><tr><th>Fecha y hora</th><th>Disciplina</th><th>Tipo</th><th>Instructor</th><th>Cupo</th><th>Reservas</th><th></th></tr></thead>
        <tbody>
          <tr>
            <td class="mono">Lun 8 · 17:00</td><td style="font-weight:600;">Dragon Fit</td>
            <td style="color:var(--ink-3);">Clase grupal</td><td>Karla V.</td><td>20</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">6/20</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td class="mono">Mar 9 · 07:00</td><td style="font-weight:600;">Musculación</td>
            <td style="color:var(--ink-3);">Acceso libre</td><td style="color:var(--ink-3);">—</td><td>25</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">12/25</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td class="mono">Mar 9 · 19:00</td><td style="font-weight:600;">CrossFit</td>
            <td style="color:var(--ink-3);">Clase grupal</td><td>Diego M.</td><td>18</td>
            <td><span class="pill" style="background:var(--ok-bg); color:var(--ok-tx);">11/18</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td class="mono">Jue 11 · 19:00</td><td style="font-weight:600;">Hyrox</td>
            <td style="color:var(--ink-3);">Preparación</td><td>Diego M.</td><td>16</td>
            <td><span class="pill" style="background:var(--da-bg); color:var(--da-tx);">16/16 · 2 en espera</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
          <tr>
            <td class="mono">Vie 12 · 18:00</td><td style="font-weight:600;">Bailoterapia</td>
            <td style="color:var(--ink-3);">Clase grupal</td><td>Karla V.</td><td>20</td>
            <td><span class="pill" style="background:var(--wa-bg); color:var(--wa-tx);">17/20</span></td>
            <td style="text-align:right; color:var(--acc); font-weight:600;">Editar</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Editor de sesión -->
    <div class="card" style="padding:22px 24px;">
      <p style="margin:0 0 16px; font-size:15px; font-weight:700;">Nueva sesión</p>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:14px;">
        <div><span class="lbl">Disciplina</span><div class="inp">CrossFit</div></div>
        <div><span class="lbl">Tipo</span><div class="inp">Clase grupal</div></div>
        <div><span class="lbl">Instructor</span><div class="inp">Diego M.</div></div>
        <div><span class="lbl">Fecha</span><div class="inp">09 / 09 / 2026</div></div>
        <div><span class="lbl">Hora de inicio</span><div class="inp">19:00</div></div>
        <div><span class="lbl">Duración</span><div class="inp">60 minutos</div></div>
        <div><span class="lbl">Cupo máximo</span><div class="inp">18</div></div>
        <div><span class="lbl">Lista de espera</span><div class="inp">Habilitada · máx. 5</div></div>
        <div><span class="lbl">Repetir</span><div class="inp">Cada semana, martes y jueves</div></div>
      </div>
      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; gap:8px;">
        <span class="btn-2">Cancelar</span>
        <span class="btn">Crear sesión</span>
      </div>
    </div>`,
})

/* ── MARCA ──────────────────────────────────────────────────── */
build({
  file: 'Marca.dc.html', w: 1200, h: 800, active: 'marca', role: 'staff',
  body: `${H('Marca del gimnasio', 'Nombre comercial, logo y color de acento de la app')}

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
      <div class="card" style="padding:24px;">
        <div style="margin-bottom:18px;">
          <span class="lbl">Nombre comercial</span>
          <div class="inp">Zona Cero Performance Center</div>
        </div>

        <div style="margin-bottom:18px;">
          <span class="lbl">Logo</span>
          <div style="border-radius:10px; border:1.5px dashed var(--line); background:var(--surface-2); padding:20px; display:flex; align-items:center; gap:16px;">
            <img src="mark-color.png" alt="Logo actual" style="height:38px; width:auto;" />
            <div>
              <p style="margin:0; font-size:12.5px; font-weight:600;">imagotipo-zonacero.png</p>
              <p style="margin:2px 0 0; font-size:11.5px; color:var(--ink-3);">PNG transparente · 694 × 220 px</p>
            </div>
            <span class="btn-2" style="margin-left:auto;">Cambiar</span>
          </div>
        </div>

        <div>
          <span class="lbl">Color de acento</span>
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="height:42px; width:42px; border-radius:10px; background:var(--acc); border:1px solid var(--line);"></div>
            <div class="inp mono" style="flex:1;">#F26D17</div>
          </div>
          <p style="margin:8px 0 0; font-size:11.5px; color:var(--ink-3); line-height:1.5;">
            Se usa en botones, enlaces y elementos activos. El texto sobre el acento se ajusta solo para mantener el contraste legible.
          </p>
        </div>

        <div style="margin-top:22px; padding-top:16px; border-top:1px solid var(--line); display:flex; justify-content:flex-end; gap:8px;">
          <span class="btn-2">Descartar</span>
          <span class="btn">Guardar marca</span>
        </div>
      </div>

      <!-- Vista previa -->
      <div class="card" style="padding:24px;">
        <p class="eyebrow" style="margin:0 0 14px;">Vista previa</p>
        <div style="border-radius:12px; border:1px solid var(--line); overflow:hidden;">
          <div style="display:flex; align-items:center; gap:9px; padding:14px 16px; border-bottom:1px solid var(--line); background:var(--surface-2);">
            <img src="mark-color.png" alt="" style="height:22px; width:auto;" />
            <span style="font-size:13px; font-weight:700;">Zona Cero</span>
          </div>
          <div style="padding:18px 16px;">
            <p style="margin:0; font-size:15px; font-weight:700;">Buenas tardes, Ana</p>
            <p style="margin:4px 0 0; font-size:12px; color:var(--ink-3);">Tu próxima clase es hoy a las 19:00</p>
            <div style="margin-top:14px; display:flex; gap:8px;">
              <span class="btn" style="padding:8px 15px; font-size:12px;">Ver reservas</span>
              <span class="btn-2" style="padding:8px 15px; font-size:12px;">Agenda</span>
            </div>
            <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--line); display:flex; gap:7px;">
              <span class="chip on" style="padding:5px 11px; font-size:11.5px;">Activo</span>
              <span class="chip" style="padding:5px 11px; font-size:11.5px;">Inactivo</span>
            </div>
          </div>
        </div>
        <p style="margin:14px 0 0; font-size:11.5px; color:var(--ink-3); line-height:1.5;">
          Los cambios se aplican a la app de socios y al panel del personal al guardar.
        </p>
      </div>
    </div>`,
})
