import fs from 'node:fs'

/*
 * Socio y ficha van en 390x844 (iPhone 14/15): el contrato entrega la app
 * de socios SOLO por App Store y Google Play, sin version web.
 * Staff va en escritorio: la clausula 5.2 entrega un panel web para el
 * personal del centro.
 */

const MOBILE = { w: 390, h: 844 }

const SOCIO = [
  'Login', 'Main', 'Agenda', 'MisReservas', 'MiPlan',
  'Explorar', 'Peso', 'Perfil', 'CheckIn',
]
const FICHA = ['Ficha', 'Ficha2', 'Ficha3']
const STAFF = [
  ['Admin', 1440, 900], ['Cobros', 1440, 960],
  ['Planes', 1440, 860], ['Sesiones', 1440, 880], ['Marca', 1200, 800],
]

const TITLES = {
  Login: 'Login', Main: 'Inicio', Agenda: 'Agenda', MisReservas: 'Mis reservas',
  MiPlan: 'Mi plan', Explorar: 'Explorar', Peso: 'Control de peso',
  Perfil: 'Perfil', CheckIn: 'Check-in QR',
  Admin: 'Panel admin', Cobros: 'Cobros POS', Planes: 'Planes',
  Sesiones: 'Sesiones', Marca: 'Marca',
  Ficha: 'Ficha · paso 1', Ficha2: 'Ficha · paso 2', Ficha3: 'Ficha · paso 3',
}

/* Los telefonos caben todos en una fila: 5 por fila con aire generoso. */
function phones(list, page, suffix, perRow = 5, gapX = 120, gapY = 180) {
  return list.map((name, i) => ({
    file: `${name}${suffix}.dc.html`,
    title: TITLES[name],
    page,
    x: (i % perRow) * (MOBILE.w + gapX),
    y: Math.floor(i / perRow) * (MOBILE.h + gapY),
    w: MOBILE.w, h: MOBILE.h,
  }))
}

function desks(list, page, suffix, cols = 3, gapX = 140, gapY = 160) {
  const out = []
  const colW = Math.max(...list.map(([, w]) => w))
  let rowY = 0
  for (let i = 0; i < list.length; i += cols) {
    const row = list.slice(i, i + cols)
    row.forEach(([name, w, h], j) => {
      out.push({ file: `${name}${suffix}.dc.html`, title: TITLES[name], page,
                 x: j * (colW + gapX), y: rowY, w, h })
    })
    rowY += Math.max(...row.map(([, , h]) => h)) + gapY
  }
  return out
}

const artboards = [
  ...phones(SOCIO, 'page-1', ''),
  ...desks(STAFF, 'page-2', ''),
  ...phones(FICHA, 'page-3', ''),
  ...phones(SOCIO, 'page-4', 'Black'),
  ...desks(STAFF, 'page-5', 'Black'),
  ...phones(FICHA, 'page-6', 'Black'),
]

const canvas = {
  pages: [
    { id: 'page-1', name: 'Opción 1 · App del socio' },
    { id: 'page-2', name: 'Opción 1 · Panel del personal' },
    { id: 'page-3', name: 'Opción 1 · Ficha de ingreso' },
    { id: 'page-4', name: 'Opción 2 · App del socio (Black)' },
    { id: 'page-5', name: 'Opción 2 · Panel del personal (Black)' },
    { id: 'page-6', name: 'Opción 2 · Ficha de ingreso (Black)' },
  ],
  artboards,
  annotations: [
    {
      id: 'op1-note', page: 'page-1', x: -560, y: 0, w: 470,
      text: 'OPCIÓN 1 · Claro\n\nApp del socio en 390×844 (iPhone 14/15). Segun la clausula 5.1 del contrato, la app de socios se entrega SOLO por App Store y Google Play — no hay version web para socios.\n\nEstructura real de la app: header compacto arriba y barra de 5 tabs abajo (Inicio, Agenda, Reservas, Mi Plan, Peso). Explorar, Perfil y Check-in se llegan desde otras pantallas, no desde los tabs.\n\nSin barra de estado dibujada: en el telefono la pinta el sistema encima.\n\nAcento naranja de marca solo en boton primario, tab activo y links.',
    },
    {
      id: 'op2-note', page: 'page-4', x: -560, y: 0, w: 470,
      text: 'OPCIÓN 2 · Black premium\n\nMismas pantallas y mismo layout que la Opción 1, para comparar 1 a 1.\n\nMonocroma: el color de accion es BLANCO (boton blanco, texto negro) en vez del naranja, que sobre negro se ve estridente. El logo va en blanco puro.\n\nEstados en tonos desaturados —salvia, arena, terracota— para que sigan siendo legibles sin colorear la pantalla.\n\nEl QR del check-in se mantiene oscuro sobre tarjeta blanca: invertirlo lo haria no escaneable.',
    },
    {
      id: 'staff-note', page: 'page-2', x: -560, y: 0, w: 470,
      text: 'PANEL DEL PERSONAL · escritorio\n\nSe mantiene en 1440px porque la clausula 5.2 entrega "un panel de administración web, de uso exclusivo del personal del centro", pensado para tablet o computador en recepcion.\n\nA definir con el cliente:\n- Reglas exactas de acceso por plan (que plan entra a que disciplina). En Planes se muestran como chips seleccionables.\n- Nombres definitivos de los planes.\n- Si recepcion puede editar la ficha de un socio o solo consultarla.',
    },
    {
      id: 'ficha-note', page: 'page-3', x: 1650, y: 0, w: 350,
      text: 'FORMULARIO: de 6 pasos a 3.\n\nLas 8 secciones del documento se agrupan en 3, porque la ficha se llena UNA vez y seis pantallas numeradas se sienten interminables en el celular:\n\n1. Datos del socio + contacto de emergencia\n2. Entrenamiento + evaluación inicial (IMC calculado)\n3. Salud (PAR-Q) + autorizaciones\n\nEn movil NO es un modal sino un flujo a pantalla completa: un modal de 390px de ancho solo roba espacio.\n\nClave del paso 3: las 5 preguntas son filas Sí/No y SOLO la que responde "Sí" abre su campo de detalle. Si aplica, aparece el aviso de certificado medico.\n\nProgreso = barra fina, no 6 pestañas.',
    },
  ],
  launch: { view: 'canvas', page: 'page-1' },
}

fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2) + '\n')
console.log(`canvas.json — ${artboards.length} artboards en ${canvas.pages.length} páginas`)
console.log(`  socio + ficha: ${MOBILE.w}×${MOBILE.h} (móvil)`)
console.log('  staff: 1440px (escritorio)')
