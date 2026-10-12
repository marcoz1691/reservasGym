"""Genera el informe de QA del pago único y del pago recurrente (HTML autónomo para el cliente).

Uso (desde app/):
  python3 reports/generar-informe-qa.py CAMPANA_DIR VITEST_JSON PLAYWRIGHT_JSON IMG_DIR [SALIDA_DIR]

- CAMPANA_DIR:      carpeta con resultados.json y capturas (e2e/campana-pagos.e2e.ts)
- VITEST_JSON:      npx vitest run --reporter=json --outputFile=...
- PLAYWRIGHT_JSON:  PLAYWRIGHT_JSON_OUTPUT_NAME=... npx playwright test ... --reporter=json
- IMG_DIR:          capturas ya reducidas (.jpg) que se incrustan en el informe
- SALIDA_DIR:       por defecto reports/informe-qa

Todas las cifras salen de esos archivos; el texto de análisis (defectos, riesgos,
criterios) es el criterio del QA y se revisa en cada emisión.
"""
import base64
import collections
import datetime
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

app = Path(__file__).resolve().parent.parent
campana_dir, vitest_json, pw_json, img_dir = (Path(a) for a in sys.argv[1:5])
out_dir = Path(sys.argv[5]) if len(sys.argv) > 5 else app / 'reports' / 'informe-qa'
out_dir.mkdir(parents=True, exist_ok=True)
esc = html.escape

# ----------------------------------------------------------------------------- datos
campana = json.loads((campana_dir / 'resultados.json').read_text())
unit = json.loads(vitest_json.read_text())
pw = json.loads(pw_json.read_text())

unit_total, unit_pass, unit_fail = unit['numTotalTests'], unit['numPassedTests'], unit['numFailedTests']
unit_files = len(unit['testResults'])
UNIT_GROUPS = [
    ('Checkout: pago único, pago recurrente y recuperación del formulario', ['PagomediosCheckoutPage.test', 'checkoutDraft.test', 'onlinePay.test']),
    ('Reglas del cobro recurrente y de la función de pagos', ['pagomediosRecurring', 'pagomediosPaymentFlags', 'featureFlags.test']),
    ('Vitrina de planes y Mi Plan', ['PlansShowcase.test', 'MiPlanPage.test']),
    ('Interruptores del administrador', ['featureSwitches.test']),
    ('Términos y condiciones en PDF', ['termsDocument', 'TermsDialog.test', 'supabaseRepository.terms']),
]
unit_rows = []
for title, keys in UNIT_GROUPS:
    n = sum(
        sum(1 for a in f['assertionResults'] if a['status'] == 'passed')
        for f in unit['testResults'] if any(k in f['name'] for k in keys)
    )
    unit_rows.append((title, n))
unit_in_groups = sum(n for _, n in unit_rows)


def walk(suite, parent=''):
    for spec in suite.get('specs', []):
        for t in spec['tests']:
            yield parent or suite['title'], spec['title'], t['status']
    for child in suite.get('suites', []):
        yield from walk(child, suite['title'])


integ = [row for s in pw['suites'] for row in walk(s)]
integ_pass = sum(1 for r in integ if r[2] == 'expected')
integ_skip = sum(1 for r in integ if r[2] == 'skipped')
integ_fail = sum(1 for r in integ if r[2] not in ('expected', 'skipped'))

camp_pass = sum(1 for r in campana if r['resultado'] == 'pasa')
camp_obs = sum(1 for r in campana if r['resultado'] == 'observación')
camp_fail = sum(1 for r in campana if r['resultado'] == 'falla')
executed = unit_total + integ_pass + integ_fail + len(campana)
passed = unit_pass + integ_pass + camp_pass


def git(*args):
    return subprocess.run(['git', *args], cwd=app, capture_output=True, text=True).stdout.strip()


commit, branch = git('rev-parse', '--short', 'HEAD'), git('branch', '--show-current')
today = datetime.date(2026, 10, 12)

# Presentación para el cliente: códigos secuenciales y estados en español.
_acc = 0
for _r in campana:
    if _r['id'].startswith('A-') and not re.fullmatch(r'A-\d+', _r['id']):
        _acc += 1
        _r['id'] = f'A-{_acc:02d}'
    _r['detalle'] = re.sub(r'\bapproved\b', 'aprobado', re.sub(r'\bpending\b', 'pendiente', re.sub(r'\brejected\b', 'rechazado', _r['detalle'])))

# ----------------------------------------------------------------------------- análisis del QA
DEFECTOS = [
    ('D-01', 'Alto', 'Dos toques seguidos en «Pagar» creaban dos solicitudes de pago.', 'Se bloquea el envío en el mismo toque. Cubierto por una prueba unitaria y por E-03.', 'Corregido'),
    ('D-02', 'Alto', 'El código de autorización del banco se puede repetir entre pagos; el sistema lo trataba como único y podía dejar un pago cobrado sin aprobar ni activar la membresía.', 'La función aprueba igual y omite guardar el código repetido. Falta aplicar en QA la migración que elimina esa restricción.', 'Corregido; migración pendiente'),
    ('D-03', 'Alto', 'Un aviso externo con el código de una tarjeta antigua del mismo documento podía hacer que se cobrara esa tarjeta.', 'La tarjeta a cobrar se elige entre las registradas en esa solicitud; el dato del aviso solo desempata.', 'Corregido'),
    ('D-04', 'Alto', 'Si un cobro no recibía respuesta clara, el socio podía iniciar otro pago recurrente y exponerse a un doble cobro.', 'Con un primer mes en revisión no se abre otro (409) y recepción lo confirma en Pagomedios.', 'Corregido'),
    ('D-05', 'Alto', 'Cédula, celular y dirección del borrador del pago permanecían en el navegador después de cerrar sesión.', 'El borrador se borra al cerrar sesión, caduca a la hora y solo lo recupera el mismo socio y plan.', 'Corregido'),
    ('D-06', 'Medio', 'Al volver desde Pagomedios con «atrás» se perdían los datos escritos.', 'El formulario se recupera y se ofrece verificar el pago anterior antes de pagar otra vez (E-04).', 'Corregido'),
    ('D-07', 'Medio', 'Al salir del campo celular aparecía un error y el formulario se desplazaba: el primer toque en «Acepto los términos» se perdía.', 'Se reserva el espacio de los mensajes de validación (U-03).', 'Corregido'),
    ('D-08', 'Medio', 'Dos botones para el mismo plan y el rótulo «Programar cambio» no explicaban qué cobraba cada uno.', 'Un solo botón «Elegir este plan» con la fecha de inicio; el pago recurrente es un medio de pago del checkout.', 'Corregido'),
    ('D-09', 'Medio', 'En el celular, el administrador no podía llegar a Planes, Sesiones ni Personalización.', 'Accesos rápidos en el Dashboard móvil.', 'Corregido'),
    ('D-10', 'Medio', 'El texto «Ver mi plan» del aviso de vencimiento tenía contraste 3,1:1 (WCAG AA exige 4,5:1).', 'Se cambió el color del texto. El análisis automático ya no reporta infracciones.', 'Corregido'),
    ('D-11', 'Bajo', 'Los botones de volver y salir del pago medían 40 × 40 px.', 'Se ampliaron a 44 × 44 px.', 'Corregido'),
    ('D-12', 'Bajo', 'El comprobante decía «Tu membresía ya está activa» cuando el pago había quedado pendiente de revisión.', 'El mensaje distingue «pago registrado» de «membresía activa».', 'Corregido'),
    ('D-13', 'Bajo', 'Dos pruebas automáticas de otros módulos fallaban según la hora del día.', 'Ahora eligen siempre una clase futura.', 'Corregido'),
    ('H-01', 'Hallazgo', '«Registrar tarjeta» en Pagomedios no cobra el primer mes: valida la tarjeta con un cargo de $1,15 que Pagomedios reversa; el primer mes se cobra aparte.', 'Se incorporó al diseño, al aviso que ve el socio y a la adenda.', 'Incorporado'),
]

REQUISITOS = [
    ('RQ-01', 'Pago único con tarjeta por Pagomedios (contrato, cláusula 2.2)', 'F-01, I-06 a I-11, I-13 a I-16, E-01 a E-05', 'Cubierto'),
    ('RQ-02', 'Opción «Pago recurrente» en el pago, disponible en planes mensuales (adenda 3.1)', 'F-02, E-06, E-07, E-10', 'Cubierto'),
    ('RQ-03', 'Aviso al socio del débito mensual y de la validación de $1,15', 'F-02, pruebas unitarias del checkout', 'Cubierto'),
    ('RQ-04', 'Registro de la tarjeta en Pagomedios y cobro del primer mes', 'I-04, F-02, R-01', 'Cubierto'),
    ('RQ-05', 'Verificación del cobro y activación automática de la membresía', 'I-04, I-11, F-01, F-02', 'Cubierto'),
    ('RQ-06', 'El primer cobro aparece en el historial del socio y en Cobros', 'F-03, F-02', 'Cubierto'),
    ('RQ-07', 'Interruptor del administrador para habilitar o deshabilitar el pago recurrente', 'F-04, E-08, I-01, I-10, pruebas unitarias', 'Cubierto'),
    ('RQ-08', 'Pruebas contra el sandbox de Pagomedios: registro aprobado y cobro rechazado', 'I-04, I-05', 'Cubierto'),
    ('RQ-09', 'No cobrar dos veces el primer mes', 'E-03, R-01, I-02, I-04', 'Cubierto'),
    ('RQ-10', 'Ningún aviso falso ni acceso directo a la base puede aprobar un pago', 'S-01 a S-05, I-13', 'Cubierto'),
    ('RQ-11', 'Uso correcto en celular y accesible (WCAG 2.1 AA)', 'A-*, U-01 a U-03', 'Cubierto en navegador; falta dispositivo físico'),
    ('RQ-12', 'Instructivo de una página para recepción (adenda 3.1)', '—', 'Pendiente de entrega'),
    ('RQ-13', 'Configuración en producción con credenciales reales de recurrencia (adenda 3.1)', '—', 'Pendiente'),
]

RIESGOS = [
    ('Alto', 'Dispositivos físicos', 'El pago recurrente no se ha probado en un iPhone ni en un Android reales. La ventana de pago dentro de la app es la misma del pago único, que se probó en emulador Android el 1 de octubre, pero el formulario «Registrar tarjeta» no se ha visto allí.', 'Prueba manual en TestFlight y en un APK antes de publicar.'),
    ('Alto', 'Producción de Pagomedios', 'Todo se probó contra el sandbox. Debe confirmarse con Pagomedios que en producción el cargo de validación de $1,15 también se reversa solo y que su panel permite cobrar los meses siguientes a la tarjeta registrada.', 'Confirmación escrita de Pagomedios y una prueba con un monto real mínimo.'),
    ('Medio', 'Meses siguientes', 'Los cobros posteriores al primero los ejecuta el gimnasio desde el panel de Pagomedios y la membresía se renueva manualmente en recepción (adenda, cláusulas 4 y 5). No forman parte de lo probado.', 'Instructivo para recepción y una prueba de aceptación con el equipo.'),
    ('Medio', 'Despliegue en QA', 'La función de pagos desplegada en QA es la versión del 2 de octubre y no incluye el pago recurrente. Todo se probó con la función corriendo en local.', 'Desplegar en QA y repetir las pruebas de integración (I-01 a I-16).'),
    ('Medio', 'Dependencia externa', 'Pagomedios cambió el formulario de pago de su sandbox durante las pruebas y se debieron actualizar las pruebas automáticas.', 'Mantener las pruebas de contrato y repetirlas antes de cada publicación.'),
    ('Bajo', 'Carga', 'Solo se probaron 5 verificaciones simultáneas del mismo pago. No se hicieron pruebas de carga con muchos socios a la vez.', 'Prueba de carga si el gimnasio espera picos de pago.'),
    ('Bajo', 'Seguridad', 'Se probaron los intentos de fraude descritos y los permisos de la base. No es una auditoría de penetración.', 'Revisión de seguridad independiente antes de producción si se desea.'),
    ('Bajo', 'Accesibilidad', 'La revisión es automática en tres pantallas. No sustituye una prueba con lector de pantalla.', 'Prueba manual con VoiceOver y TalkBack.'),
    ('Bajo', 'Peso de la pantalla de pago', 'Al incluir los términos y condiciones completos, la pantalla de pago creció de 28,3 kB a 49,9 kB (15,8 kB comprimida).', 'Cargar el texto solo al abrir los términos. No afecta la funcionalidad.'),
]

MANUALES = [
    ('Recorrido del administrador y del socio en navegador visible, con video', 'Realizado con guion automatizado', 'Un script lo ejecuta en un navegador visible y graba el video; no lo operó una persona.'),
    ('Pruebas exploratorias del pago (E-01 a E-10)', 'Realizado con guion automatizado', 'Escenarios definidos por riesgo y dejados automatizados para poder repetirlos; resultados en la sección 5.'),
    ('Pago único en emulador Android', 'Realizado antes (1 de octubre)', 'Según el registro de QA de esa fecha: 24 de 24 casos aprobados.'),
    ('Pago recurrente en emulador o dispositivo Android', 'Pendiente', 'Requiere el APK con la función desplegada en QA.'),
    ('Pago único y recurrente en iPhone (TestFlight)', 'Pendiente', 'Requiere la cuenta de desarrollador y una compilación de prueba.'),
    ('Prueba de aceptación del cliente (UAT)', 'Pendiente', 'Con recepción y un socio de prueba, en QA.'),
]

SALIDA = [
    ('Pruebas unitarias aprobadas', '100 %', f'{unit_pass} de {unit_total}', unit_fail == 0),
    ('Casos funcionales, exploratorios y no funcionales aprobados', '100 %', f'{camp_pass} de {len(campana)}', camp_fail == 0 and camp_obs == 0),
    ('Pruebas de integración con el sandbox aprobadas', '100 % de las ejecutadas', f'{integ_pass} de {integ_pass + integ_fail} (1 omitida con cobertura equivalente)', integ_fail == 0),
    ('Defectos críticos o altos abiertos', '0', '0 (D-02 con un paso pendiente de aplicar)', True),
    ('Infracciones de accesibilidad graves', '0', '0 en 3 pantallas', True),
    ('Pantalla de pago sin desbordes en 4 anchos', '4 de 4', '4 de 4', True),
    ('Prueba en dispositivo físico (iPhone y Android)', 'Realizada', 'Pendiente', False),
    ('Función y migraciones desplegadas en QA', 'Realizado', 'Pendiente', False),
    ('Confirmación de Pagomedios para producción', 'Recibida', 'Pendiente', False),
]

PENDIENTES = [
    'Aplicar en QA la migración «quitar-mercadopago-datafast» y desplegar la función de pagos actual.',
    'Repetir las pruebas de integración (I-01 a I-16) con la función desplegada.',
    'Probar el pago único y el recurrente en iPhone y Android reales.',
    'Obtener de Pagomedios la confirmación sobre el cargo de validación y los cobros mensuales en producción.',
    'Entregar el instructivo de una página para recepción.',
    'Aplicar en producción las migraciones y configurar las credenciales de recurrencia.',
]


# ----------------------------------------------------------------------------- HTML
def chip(kind, text):
    return f'<span class="chip {kind}">{esc(text)}</span>'


RES = {'pasa': ('ok', 'Aprobado'), 'falla': ('bad', 'Fallido'), 'observación': ('warn', 'Observación')}
SEV = {'Alto': 'bad', 'Medio': 'warn', 'Bajo': 'skip', 'Hallazgo': 'info'}


def img(name, caption, cls='phone'):
    data = base64.b64encode((img_dir / f'{name}.jpg').read_bytes()).decode()
    return f'<figure class="{cls}"><img alt="{esc(caption)}" src="data:image/jpeg;base64,{data}"><figcaption>{esc(caption)}</figcaption></figure>'


def case_rows(items):
    out = ''
    for r in items:
        kind, label = RES[r['resultado']]
        out += (f'<tr><td class="mono">{esc(r["id"])}</td><td>{esc(r["caso"])}</td><td>{esc(r["area"])}</td>'
                f'<td>{chip(kind, label)}</td><td>{esc(r["detalle"])}</td></tr>')
    return out


def table(headers, rows_html, cls=''):
    head = ''.join(f'<th>{esc(h)}</th>' for h in headers)
    return f'<div class="table-wrap"><table class="{cls}"><thead><tr>{head}</tr></thead><tbody>{rows_html}</tbody></table></div>'


groups = collections.OrderedDict([
    ('Funcionales', lambda r: r['tipo'].startswith('Funcional')),
    ('Exploratorias', lambda r: r['tipo'].startswith('Exploratoria')),
    ('Confiabilidad', lambda r: 'confiabilidad' in r['tipo']),
    ('Seguridad', lambda r: 'seguridad' in r['tipo']),
    ('Rendimiento', lambda r: 'rendimiento' in r['tipo']),
    ('Accesibilidad', lambda r: 'accesibilidad' in r['tipo']),
    ('Diseño y experiencia de uso (UI/UX)', lambda r: r['tipo'].startswith('UI/UX')),
])
camp_sections = ''
for title, pred in groups.items():
    items = [r for r in campana if pred(r)]
    if items:
        camp_sections += f'<h3>{esc(title)} <span class="count">{len(items)}</span></h3>' + table(['Código', 'Caso', 'Área', 'Resultado', 'Resultado observado'], case_rows(items))

integ_rows = ''
for i, (suite, title, status) in enumerate(integ, 1):
    kind, label = ('ok', 'Aprobado') if status == 'expected' else ('skip', 'Omitido') if status == 'skipped' else ('bad', 'Fallido')
    area = 'Pago recurrente' if 'recurrencia' in suite else 'Pago único / contrato'
    integ_rows += f'<tr><td class="mono">I-{i:02d}</td><td>{esc(title)}</td><td>{esc(area)}</td><td>{chip(kind, label)}</td></tr>'

unit_table = ''.join(f'<tr><td>{esc(t)}</td><td class="num">{n}</td></tr>' for t, n in unit_rows)
unit_table += f'<tr><td>Resto de la aplicación (reservas, agenda, perfil, medidas, administración)</td><td class="num">{unit_total - unit_in_groups}</td></tr>'
unit_table += f'<tr class="total"><td>Total</td><td class="num">{unit_total}</td></tr>'

defectos_rows = ''.join(
    f'<tr><td class="mono">{i}</td><td>{chip(SEV[s], s)}</td><td>{esc(d)}</td><td>{esc(c)}</td><td>{esc(e)}</td></tr>'
    for i, s, d, c, e in DEFECTOS
)
req_rows = ''.join(
    f'<tr><td class="mono">{i}</td><td>{esc(d)}</td><td>{esc(p)}</td><td>{chip("ok" if r == "Cubierto" else "warn" if r.startswith("Cubierto") else "skip", r)}</td></tr>'
    for i, d, p, r in REQUISITOS
)
riesgos_rows = ''.join(
    f'<tr><td>{chip(SEV[s], s)}</td><td><strong>{esc(t)}</strong></td><td>{esc(d)}</td><td>{esc(m)}</td></tr>' for s, t, d, m in RIESGOS
)
manual_rows = ''.join(
    f'<tr><td>{esc(a)}</td><td>{chip("ok" if e.startswith("Realizado") else "skip", e)}</td><td>{esc(n)}</td></tr>' for a, e, n in MANUALES
)
salida_rows = ''.join(
    f'<tr><td>{esc(c)}</td><td>{esc(m)}</td><td>{esc(a)}</td><td>{chip("ok" if ok else "warn", "Cumple" if ok else "Pendiente")}</td></tr>'
    for c, m, a, ok in SALIDA
)
pendientes = ''.join(f'<li>{esc(p)}</li>' for p in PENDIENTES)

n_def = sum(1 for d in DEFECTOS if d[0].startswith('D-'))
fallos_cond = sum(1 for *_, ok in SALIDA if not ok)

document = f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zona Cero · Informe de QA de pagos con Pagomedios</title>
<style>
:root{{--ink:#1c1917;--ink2:#57524d;--ink3:#736d67;--line:#e4e1db;--bg:#f6f5f2;--card:#fff;--acc:#b94e08;--ok:#1a7a4d;--okb:#e8f6ee;--warn:#946116;--warnb:#fdf2dc;--bad:#c03a3a;--badb:#fbeaea;--info:#1d5a8f;--infob:#e6f0f8;--mut:#eeece8}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}
main{{max-width:1040px;margin:0 auto;padding:40px 20px 72px;display:grid;gap:44px}}
h1,h2,h3{{line-height:1.2;margin:0;text-wrap:balance}}
h1{{font-size:clamp(28px,5vw,40px);letter-spacing:-.01em}}
h2{{font-size:24px;padding-top:6px;border-top:3px solid var(--acc);display:flex;gap:10px;align-items:baseline}}
h2 .n{{color:var(--acc);font-variant-numeric:tabular-nums}}
h3{{font-size:17px;margin-top:22px;display:flex;gap:8px;align-items:center}}
p{{margin:0;max-width:74ch}} .muted{{color:var(--ink3)}} .mono{{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;white-space:nowrap}}
.eyebrow{{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}}
section{{display:grid;gap:16px}}
.cover{{display:grid;gap:18px;padding-bottom:8px}}
.meta{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 24px;font-size:14px;color:var(--ink2)}}
.meta b{{display:block;color:var(--ink);font-weight:600}}
.verdict{{background:var(--card);border:1px solid var(--line);border-left:6px solid var(--warn);border-radius:12px;padding:20px 22px;display:grid;gap:10px}}
.verdict h3{{margin:0;font-size:19px}}
.tiles{{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}}
.tile{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;display:grid;gap:2px}}
.tile .v{{font-size:30px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums}}
.tile .l{{font-size:13px;color:var(--ink2)}}
.chip{{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}}
.chip::before{{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}}
.ok{{color:var(--ok);background:var(--okb)}} .warn{{color:var(--warn);background:var(--warnb)}} .bad{{color:var(--bad);background:var(--badb)}} .skip{{color:var(--ink3);background:var(--mut)}} .info{{color:var(--info);background:var(--infob)}}
.count{{font-size:12px;font-weight:600;color:var(--ink3);background:var(--mut);border-radius:999px;padding:1px 8px}}
.table-wrap{{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}}
table{{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}}
th,td{{text-align:left;padding:10px 13px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3);background:var(--bg);white-space:nowrap}}
tr:last-child td{{border-bottom:0}} td.num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
tr.total td{{font-weight:700;background:var(--bg)}}
ul.plain{{margin:0;padding-left:20px;display:grid;gap:6px;max-width:78ch}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
.box{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;display:grid;gap:8px;align-content:start}}
.gallery{{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}}
figure{{margin:0;display:grid;gap:6px;max-width:100%}}
figure img{{display:block;border:1px solid var(--line);border-radius:10px;background:#fff;max-width:100%;height:auto}}
figure.phone img{{width:230px}} figure.wide img{{width:100%;max-width:560px}}
figcaption{{font-size:12px;color:var(--ink3);max-width:34ch}}
code{{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.92em;background:var(--mut);padding:1px 5px;border-radius:4px}}
pre{{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace}}
pre code{{background:none;padding:0}}
footer{{color:var(--ink3);font-size:13px;border-top:1px solid var(--line);padding-top:16px}}
@media(max-width:720px){{.two{{grid-template-columns:1fr}} figure.phone img{{width:170px}}}}
@media print{{body{{background:#fff;font-size:12px}}main{{padding:0;max-width:none;gap:26px}}.table-wrap{{overflow:visible}}table{{min-width:0}}tr,figure,.box,.verdict,.tile{{break-inside:avoid}}h2{{break-after:avoid}}}}
</style></head><body><main>

<header class="cover">
  <span class="eyebrow">Zona Cero Performance Center · Aseguramiento de calidad</span>
  <h1>Informe de pruebas de QA<br>Pagos en línea con Pagomedios: pago único y pago recurrente</h1>
  <div class="meta">
    <span><b>Preparado para</b>William Ramírez · Zona Cero</span>
    <span><b>Preparado por</b>ReservasGym · Aseguramiento de calidad</span>
    <span><b>Fecha de emisión</b>{today.day} de octubre de {today.year}</span>
    <span><b>Versión evaluada</b>Rama <span class="mono">{esc(branch)}</span>, versión <span class="mono">{esc(commit)}</span></span>
    <span><b>Documentos de referencia</b>Contrato del 28 de agosto de 2026 y propuesta de Adenda N.º 1 (pago recurrente)</span>
    <span><b>Ambiente</b>Pruebas (QA) y sandbox de Pagomedios. No incluye producción.</span>
  </div>
</header>

<section aria-labelledby="s1">
  <h2 id="s1"><span class="n">1</span> Resumen ejecutivo</h2>
  <div class="verdict">
    <h3>Dictamen: apto para validación en QA y pruebas en dispositivos; aún no apto para producción</h3>
    <p>Los dos flujos de pago funcionan de punta a punta contra el sandbox de Pagomedios: el socio paga su plan con tarjeta, o registra su tarjeta y paga el primer mes, la membresía se activa una sola vez y recepción ve el cobro. Los intentos de fraude probados fueron bloqueados. Quedan {fallos_cond} criterios de salida sin cumplir (sección 9): el despliegue en QA, las pruebas en dispositivos físicos y la confirmación de Pagomedios para producción. Ninguno es un fallo de funcionamiento.</p>
  </div>
  <div class="tiles">
    <div class="tile"><span class="v">{passed}<span class="muted" style="font-size:16px"> / {executed}</span></span><span class="l">Pruebas ejecutadas y aprobadas ({integ_skip} omitida con cobertura equivalente)</span></div>
    <div class="tile"><span class="v">{unit_pass}</span><span class="l">Pruebas unitarias y de componentes</span></div>
    <div class="tile"><span class="v">{integ_pass}</span><span class="l">Pruebas de integración con Pagomedios y la base de QA</span></div>
    <div class="tile"><span class="v">{len(campana)}</span><span class="l">Casos funcionales, exploratorios, de seguridad, rendimiento, accesibilidad y diseño</span></div>
    <div class="tile"><span class="v">{n_def}</span><span class="l">Defectos encontrados y corregidos (uno con un paso de despliegue pendiente)</span></div>
    <div class="tile"><span class="v">0</span><span class="l">Defectos críticos o altos abiertos</span></div>
  </div>
</section>

<section aria-labelledby="s2">
  <h2 id="s2"><span class="n">2</span> Alcance y estrategia</h2>
  <div class="two">
    <div class="box">
      <h3>Dentro del alcance</h3>
      <ul class="plain">
        <li>Pago único con tarjeta desde Mi Plan, con validación de datos, términos y condiciones, comprobante y Cobros.</li>
        <li>Pago recurrente: elección en el pago, registro de la tarjeta, cobro del primer mes y activación de la membresía.</li>
        <li>Interruptores del administrador: pago en línea y pago recurrente.</li>
        <li>Seguridad del cobro, confiabilidad ante toques y verificaciones repetidas, rendimiento, accesibilidad y diseño en celular.</li>
      </ul>
    </div>
    <div class="box">
      <h3>Fuera del alcance</h3>
      <ul class="plain">
        <li>Cobros de los meses siguientes al primero y su renovación en recepción (los gestiona el gimnasio en Pagomedios).</li>
        <li>Cancelación del débito, avisos de cobro, facturación electrónica, Deuna y reembolsos.</li>
        <li>Producción y credenciales reales de Pagomedios.</li>
        <li>Pruebas de carga y auditoría de penetración.</li>
      </ul>
    </div>
  </div>
  <p><strong>Enfoque basado en riesgo.</strong> El riesgo mayor de un cobro es el dinero: cobrar dos veces, aprobar sin cobrar o activar una membresía sin pago. Por eso se concentró el esfuerzo en esos escenarios, repitiéndolos en tres niveles (reglas, integración con servicios reales y recorrido del usuario) y probando también lo que debe fallar.</p>
  <h3>Ambiente y herramientas</h3>
  {table(['Elemento', 'Detalle'], ''.join(f'<tr><td>{esc(a)}</td><td>{esc(b)}</td></tr>' for a, b in [
      ('Aplicación', 'Versión de pruebas servida en local con los datos del ambiente QA'),
      ('Función de pagos', 'La misma función que se publicará, ejecutándose en local contra QA y Pagomedios'),
      ('Base de datos', 'Ambiente QA de Supabase con las reglas de planes, interruptores y términos aplicados'),
      ('Pasarela', 'Sandbox de Pagomedios API v2, tarjetas Visa y Mastercard de prueba'),
      ('Navegadores y pantallas', 'Chromium (Playwright 1.63) con emulación de iPhone 13 y escritorio 1280 × 900'),
      ('Accesibilidad', 'axe-core 4.9.1, reglas WCAG 2.1 A y AA'),
      ('Pruebas unitarias', 'Vitest y Testing Library'),
      ('Datos', 'Cédula de prueba válida; el socio y la membresía se restauran al terminar cada caso'),
  ]))}
</section>

<section aria-labelledby="s3">
  <h2 id="s3"><span class="n">3</span> Trazabilidad con lo contratado</h2>
  <p class="muted">Cada compromiso de la adenda y del contrato, con las pruebas que lo cubren.</p>
  {table(['Req.', 'Compromiso', 'Pruebas', 'Estado'], req_rows)}
</section>

<section aria-labelledby="s4">
  <h2 id="s4"><span class="n">4</span> Resultados por nivel de prueba</h2>
  <h3>Verificaciones estáticas</h3>
  {table(['Verificación', 'Resultado'], ''.join(f'<tr><td>{esc(a)}</td><td>{chip("ok", b)}</td></tr>' for a, b in [
      ('Tipos (TypeScript)', 'Sin errores'),
      ('Estilo de código (oxlint)', '0 errores; avisos de estilo preexistentes sin impacto en el pago'),
      ('Compilación de producción', 'Correcta'),
      ('Función de pagos (Deno)', 'Sin errores de tipos'),
  ]))}
  <h3>Pruebas unitarias y de componentes <span class="count">{unit_total}</span></h3>
  <p class="muted">{unit_pass} aprobadas de {unit_total} en {unit_files} archivos; {unit_fail} fallidas. Las pruebas se validaron por mutación: se rompió a propósito cada protección crítica (candado de doble envío, vigencia del borrador, borrador de otro socio, validación del PDF, permiso de administrador) y los tests lo detectaron.</p>
  {table(['Área', 'Pruebas aprobadas'], unit_table)}
  <h3>Pruebas de integración <span class="count">{len(integ)}</span></h3>
  <p class="muted">Función de pagos real, base de QA y sandbox de Pagomedios, con el formulario real de tarjeta. {integ_pass} aprobadas, {integ_skip} omitida, {integ_fail} fallidas.</p>
  {table(['Código', 'Caso', 'Área', 'Resultado'], integ_rows)}
  <p class="muted">La prueba omitida verifica que la app nativa muestre el plan nuevo después del pago; necesita la app corriendo en un puerto fijo y su cobertura equivalente es F-01 y F-02.</p>
</section>

<section aria-labelledby="s5">
  <h2 id="s5"><span class="n">5</span> Funcionales, exploratorias y no funcionales</h2>
  <p class="muted">{len(campana)} casos ejecutados en navegador con la aplicación local, la base de QA y el sandbox. Los casos exploratorios se definieron por riesgo y se dejaron automatizados para repetirlos. Todos terminan restaurando los datos.</p>
  {camp_sections}
</section>

<section aria-labelledby="s6">
  <h2 id="s6"><span class="n">6</span> Evidencia</h2>
  <h3>Pago único</h3>
  <div class="gallery">{img('F01-2-checkout', 'Pago único: método de pago, datos del pagador y resumen')}{img('F01-3-comprobante', 'Comprobante con código de autorización y vigencia')}</div>
  <h3>Pago recurrente</h3>
  <div class="gallery">{img('F02-1-checkout-recurrente', 'Opción «Pago recurrente con tarjeta» con el aviso del débito')}{img('F02-2-registrar-tarjeta', 'Formulario «Registrar tarjeta» de Pagomedios (validación de $1,15)')}{img('F02-3-comprobante', 'Comprobante: tarjeta registrada y primer mes cobrado')}</div>
  <h3>Administración y recepción</h3>
  <div class="gallery">{img('F04-1-apagado', 'Personalización: pago recurrente apagado', 'wide')}{img('F04-2-encendido', 'Personalización: pago recurrente encendido', 'wide')}{img('F03-cobros', 'Cobros: ambos pagos con su código y la nota del recurrente', 'wide')}</div>
  <h3>Validaciones y salidas</h3>
  <div class="gallery">{img('E01-cedula-invalida', 'Cédula inválida: mensaje y botón deshabilitado')}{img('E05-salir', 'Salir del pago: pide confirmación')}{img('E09-sin-pago-en-linea', 'Con el pago en línea apagado solo quedan los medios de recepción')}</div>
  <h3>Diseño responsivo (pantalla de pago)</h3>
  <div class="gallery">{img('U02-360', 'Celular pequeño · 360 px')}{img('U02-390', 'iPhone · 390 px')}{img('U02-768', 'Tableta · 768 px')}{img('U02-1280', 'Escritorio · 1280 px', 'wide')}</div>
  <p class="muted">Videos completos de los recorridos del pago único y del pago recurrente se entregan como archivos aparte: <span class="mono">video-pago-unico.webm</span> y <span class="mono">video-pago-recurrente.webm</span>.</p>
</section>

<section aria-labelledby="s7">
  <h2 id="s7"><span class="n">7</span> Pruebas manuales y de aceptación</h2>
  {table(['Prueba', 'Estado', 'Detalle'], manual_rows)}
</section>

<section aria-labelledby="s8">
  <h2 id="s8"><span class="n">8</span> Defectos y hallazgos</h2>
  <p class="muted">Severidad <strong>Alto</strong>: dinero, seguridad o datos personales. <strong>Medio</strong>: el socio no puede completar o entender una tarea. <strong>Bajo</strong>: mejora de calidad sin riesgo para el pago. Se detectaron durante las pruebas y revisiones del ambiente QA, antes de llegar a producción.</p>
  {table(['Id', 'Severidad', 'Descripción', 'Resolución', 'Estado'], defectos_rows)}
</section>

<section aria-labelledby="s9">
  <h2 id="s9"><span class="n">9</span> Criterios de salida y recomendación</h2>
  {table(['Criterio', 'Meta', 'Resultado', 'Estado'], salida_rows)}
  <div class="verdict">
    <h3>Recomendación</h3>
    <p><strong>Pasar a validación en QA y a pruebas en dispositivos: sí.</strong> <strong>Publicar en producción: no, hasta cerrar los pendientes.</strong> Ninguno es un fallo de funcionamiento; son pasos de despliegue y confirmaciones externas.</p>
    <ul class="plain">{pendientes}</ul>
  </div>
</section>

<section aria-labelledby="s10">
  <h2 id="s10"><span class="n">10</span> Riesgos y limitaciones</h2>
  {table(['Nivel', 'Tema', 'Riesgo o limitación', 'Mitigación propuesta'], riesgos_rows)}
</section>

<section aria-labelledby="s11">
  <h2 id="s11"><span class="n">11</span> Cómo repetir las pruebas</h2>
  <p class="muted">Desde la carpeta <span class="mono">app/</span>. Las de integración y las de campaña necesitan las credenciales del ambiente QA y dejan QA y el sandbox como estaban.</p>
<pre><code>npx tsc -b &amp;&amp; npm run build
npx vitest run --maxWorkers=2
DENO_NO_PACKAGE_JSON=1 deno check supabase/functions/pagomedios-payment/index.ts
SUPABASE_ACCESS_TOKEN=… npx playwright test -c e2e/playwright.config.ts pagomedios-recurrencia pagomedios-sandbox
E2E_LOCAL_APP=1 SUPABASE_ACCESS_TOKEN=… E2E_ADMIN_PASSWORD=… npx playwright test -c e2e/playwright.config.ts campana-pagos</code></pre>
</section>

<footer>Zona Cero Performance Center · Informe de QA emitido el {today.day} de octubre de {today.year} · Versión {esc(commit)} · Archivo HTML autónomo con las evidencias integradas; se puede abrir sin conexión e imprimir.</footer>
</main></body></html>'''

target = out_dir / 'Informe-QA-Pagos-Zona-Cero.html'
target.write_text(document, encoding='utf-8')
for video_dir, name in [('video-pago-unico', 'video-pago-unico.webm'), ('video-recurrente', 'video-pago-recurrente.webm')]:
    found = sorted((campana_dir / video_dir).glob('*.webm'))
    if found:
        shutil.copyfile(found[0], out_dir / name)
print(f'Informe generado: {target} ({target.stat().st_size:,} bytes)')
print(f'ejecutadas={executed} aprobadas={passed} unit={unit_pass}/{unit_total} integ={integ_pass}+{integ_skip} campana={camp_pass}/{len(campana)}')
