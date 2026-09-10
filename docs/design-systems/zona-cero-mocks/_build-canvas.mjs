import fs from 'node:fs'

/* Layout de las dos opciones. Mismas posiciones en ambas para que la
   comparacion sea directa: cada pantalla cae en el mismo lugar. */

const SOCIO = [
  ['Login', 1280, 820], ['Main', 1440, 940], ['Agenda', 1440, 960],
  ['MisReservas', 1440, 900], ['MiPlan', 1440, 1180], ['Explorar', 1440, 900],
  ['Peso', 1440, 980], ['Perfil', 1440, 900], ['CheckIn', 1100, 820],
]
const STAFF = [
  ['Admin', 1440, 900], ['Cobros', 1440, 960],
  ['Planes', 1440, 860], ['Sesiones', 1440, 880],
  ['Marca', 1200, 800],
]
const FICHA = [
  ['Ficha', 920, 740], ['Ficha2', 920, 780], ['Ficha3', 920, 900],
]

const TITLES = {
  Login: 'Login', Main: 'Inicio', Agenda: 'Agenda', MisReservas: 'Mis reservas',
  MiPlan: 'Mi plan', Explorar: 'Explorar', Peso: 'Control de peso',
  Perfil: 'Perfil', CheckIn: 'Check-in QR',
  Admin: 'Panel admin', Cobros: 'Cobros POS', Planes: 'Planes',
  Sesiones: 'Sesiones', Marca: 'Marca',
  Ficha: 'Ficha · paso 1', Ficha2: 'Ficha · paso 2', Ficha3: 'Ficha · paso 3',
}

/* Coloca en grilla de 3 columnas, respetando el alto de cada fila. */
function grid(list, page, suffix, cols = 3, gapX = 140, gapY = 160) {
  const out = []
  const colW = Math.max(...list.map(([, w]) => w))
  let rowY = 0
  for (let i = 0; i < list.length; i += cols) {
    const row = list.slice(i, i + cols)
    row.forEach(([name, w, h], j) => {
      out.push({
        file: `${name}${suffix}.dc.html`,
        title: TITLES[name],
        page,
        x: j * (colW + gapX),
        y: rowY,
        w, h,
      })
    })
    rowY += Math.max(...row.map(([, , h]) => h)) + gapY
  }
  return out
}

const artboards = [
  ...grid(SOCIO, 'page-1', ''),
  ...grid(STAFF, 'page-2', ''),
  ...grid(FICHA, 'page-3', ''),
  ...grid(SOCIO, 'page-4', 'Black'),
  ...grid(STAFF, 'page-5', 'Black'),
  ...grid(FICHA, 'page-6', 'Black'),
]

const canvas = {
  pages: [
    { id: 'page-1', name: 'Opción 1 · Socio' },
    { id: 'page-2', name: 'Opción 1 · Staff' },
    { id: 'page-3', name: 'Opción 1 · Ficha' },
    { id: 'page-4', name: 'Opción 2 · Socio (Black)' },
    { id: 'page-5', name: 'Opción 2 · Staff (Black)' },
    { id: 'page-6', name: 'Opción 2 · Ficha (Black)' },
  ],
  artboards,
  annotations: [
    {
      id: 'op1-note', page: 'page-1', x: -560, y: 0, w: 460,
      text: 'OPCIÓN 1 · Claro\n\nSigue el login real de GYM-One: fondo claro con puntos sutiles, tarjetas blancas, sombra suave, radios 8-16px.\n\nEl naranja de marca #F26D17 aparece solo en el botón primario, el item activo del sidebar, el borde del plan actual y los links. Logo a color.\n\nEstados en verde/ámbar/rojo desaturado (patrón .bg-label-* de GYM-One).',
    },
    {
      id: 'op2-note', page: 'page-4', x: -560, y: 0, w: 460,
      text: 'OPCIÓN 2 · Black premium\n\nMonocroma. El color de acción es BLANCO (botón blanco, texto negro) en vez del naranja: sobre negro el naranja se ve estridente, no premium.\n\nLogo en blanco puro, sin naranja.\n\nEstados en tonos desaturados —salvia, arena, terracota— para que sigan siendo legibles sin colorear la pantalla.\n\nMismas pantallas y mismo layout que la Opción 1, para comparar 1 a 1.',
    },
    {
      id: 'ficha-note', page: 'page-3', x: 3180, y: 0, w: 330,
      text: 'FORMULARIO: de 6 pasos a 3.\n\nLas 8 secciones del documento se agrupan en 3, porque la ficha se llena UNA vez y seis pantallas numeradas se sienten interminables en el celular:\n\n1. Datos del socio + contacto de emergencia\n2. Entrenamiento + evaluación inicial (IMC calculado)\n3. Salud (PAR-Q) + autorizaciones\n\nClave minimalista del paso 3: las 5 preguntas son filas Sí/No y SOLO la que responde "Sí" despliega su campo de detalle. Si aplica, aparece el aviso de certificado médico.\n\nProgreso = barra fina, no 6 pestañas numeradas.',
    },
    {
      id: 'pend-note', page: 'page-2', x: 3160, y: 0, w: 330,
      text: 'Pendiente de definir con el cliente:\n\n- Reglas exactas de acceso por plan (qué plan entra a qué disciplina). En Planes se muestran como chips seleccionables; las combinaciones reales las define el cliente en el kickoff.\n- Nombres definitivos de los planes.\n- Si recepción puede editar la ficha de un socio o solo consultarla.',
    },
  ],
  launch: { view: 'canvas', page: 'page-4' },
}

fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2) + '\n')
console.log(`canvas.json — ${artboards.length} artboards en ${canvas.pages.length} páginas`)
