import { TERMS } from './termsContent'

/**
 * Documentos legales de la app (LOPDP Ecuador). Cada uno tiene versión: la aceptación que
 * se guarda en legal_consents apunta a esta versión. Al cambiar el texto de forma
 * sustancial, subir la versión para que las nuevas aceptaciones queden diferenciadas.
 *
 * Borrador técnico: el contenido debe validarlo el cliente y su asesor legal.
 */
export type LegalDocument = {
  slug: string
  title: string
  version: string
  updatedAt: string
  sections: { title: string; paragraphs: string[] }[]
}

// Contacto del responsable (LOPDP art. 12): el del cliente en el contrato. Confirmar con William antes de publicar.
const CONTACT_EMAIL = 'zonacerowramirez@gmail.com'
const ADDRESS = 'Plaza Comercial Mitad del Mundo, Quito, Ecuador'

export const PRIVACY: LegalDocument = {
  slug: 'privacidad',
  title: 'Política de privacidad',
  version: '1.0',
  updatedAt: '2026-10-15',
  sections: [
    {
      title: '1. Responsable del tratamiento',
      paragraphs: [
        `Zona Cero Performance Center, representado por William Ramírez, con domicilio en ${ADDRESS} (en adelante, «Zona Cero»), es responsable del tratamiento de los datos personales que se recogen en esta aplicación y en su versión web.`,
        `Para consultas o para ejercer sus derechos, el titular puede escribir a ${CONTACT_EMAIL} o acudir a la recepción del gimnasio en esa dirección.`,
      ],
    },
    {
      title: '2. Marco legal',
      paragraphs: [
        'El tratamiento se rige por la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP), su Reglamento General y las resoluciones de la Superintendencia de Protección de Datos Personales.',
      ],
    },
    {
      title: '3. Datos que tratamos',
      paragraphs: [
        'Datos de cuenta: nombre completo, correo electrónico y contraseña (la contraseña se guarda cifrada y nadie del gimnasio puede verla).',
        'Ficha del socio: fecha de nacimiento, sector o ciudad de residencia y objetivos de entrenamiento.',
        'Datos de salud (categoría especial): estatura, peso, medidas corporales, índice de masa corporal calculado y dolencias o lesiones que el socio decida informar. Solo se tratan con su consentimiento expreso, que se pide por separado al completar la ficha.',
        'Uso del servicio: reservas, asistencias (check-in), lista de espera, membresías y pagos registrados.',
        'Datos de facturación para pagos con tarjeta: tipo y número de identificación, celular y dirección. Los datos de la tarjeta los recibe directamente el procesador de pagos; Zona Cero no los ve ni los guarda.',
        'Datos técnicos mínimos: identificador de sesión y, al aceptar documentos, la fecha, la hora y el navegador o la app desde donde se aceptó.',
      ],
    },
    {
      title: '4. Para qué los usamos',
      paragraphs: [
        'Gestionar la cuenta, las reservas, la asistencia, las membresías, los cobros y su historial.',
        'Que los entrenadores adapten el entrenamiento y prevengan lesiones con la información de salud que el socio comparta.',
        'Enviar avisos del servicio: confirmaciones, cupos liberados y vencimiento de la membresía.',
        'Cumplir obligaciones legales, contables y tributarias, y mantener la seguridad de la aplicación.',
        'Zona Cero no vende, alquila ni cede datos personales con fines comerciales, no muestra publicidad de terceros y no usa identificadores publicitarios ni herramientas de rastreo.',
      ],
    },
    {
      title: '5. Base legal',
      paragraphs: [
        'La ejecución de la relación con el socio (cuenta, reservas, membresías y cobros).',
        'El consentimiento expreso del titular para los datos de salud y para esta política, que se registra con fecha, hora y versión del documento.',
        'El cumplimiento de obligaciones legales, por ejemplo, conservar los registros de pagos.',
        'El titular puede retirar su consentimiento en cualquier momento, sin efecto retroactivo, desde la recepción o por correo. Retirar el consentimiento de los datos de salud implica borrarlos de la ficha.',
      ],
    },
    {
      title: '6. Con quién compartimos datos',
      paragraphs: [
        'Supabase Inc.: base de datos y autenticación. Los servidores están en São Paulo, Brasil. Esto constituye una transferencia internacional de datos, que se realiza con un proveedor que aplica cifrado en tránsito y en reposo y controles de acceso.',
        'Vercel Inc.: alojamiento de la versión web de la aplicación (Estados Unidos). No guarda la base de datos de socios.',
        'Pagomedios (Abitmedia S.A., Ecuador): procesamiento de pagos con tarjeta. Recibe los datos de facturación y los de la tarjeta para procesar el cobro.',
        'Apple y Google: distribución de la app en sus tiendas, según sus propias políticas.',
        'Autoridades competentes, solo cuando la ley lo exija.',
      ],
    },
    {
      title: '7. Cuánto tiempo los conservamos',
      paragraphs: [
        'Mientras la cuenta esté activa. Si el socio elimina su cuenta, se borran su perfil, ficha, datos de salud, medidas, reservas, solicitudes de pago pendientes y aceptaciones registradas.',
        'Los cobros realizados se conservan anonimizados, sin el nombre, el correo ni la identificación del socio, solo con el monto, el plan, la fecha, el medio y la referencia, durante el plazo que exige la normativa contable y tributaria.',
      ],
    },
    {
      title: '8. Seguridad',
      paragraphs: [
        'Las comunicaciones viajan cifradas (HTTPS). La base de datos aplica permisos por fila: cada socio solo accede a sus propios datos y el personal del gimnasio accede según su rol.',
        'Si ocurre una vulneración de seguridad que afecte datos personales, Zona Cero la notificará a la Superintendencia de Protección de Datos Personales y a los titulares afectados en los plazos de la ley.',
      ],
    },
    {
      title: '9. Derechos del titular',
      paragraphs: [
        'El titular puede ejercer sus derechos de acceso, rectificación y actualización, eliminación, oposición, portabilidad, suspensión del tratamiento y a no ser objeto de decisiones basadas únicamente en valoraciones automatizadas.',
        'Puede eliminar su cuenta directamente desde Mi Perfil → «Eliminar mi cuenta y mis datos».',
        `Para los demás derechos, puede escribir a ${CONTACT_EMAIL} con su nombre y una copia de su documento de identidad. Zona Cero responderá dentro del plazo que establece la LOPDP. Si no está conforme con la respuesta, puede acudir a la Superintendencia de Protección de Datos Personales.`,
      ],
    },
    {
      title: '10. Menores de edad',
      paragraphs: [
        'Las personas menores de 18 años solo pueden usar la aplicación con la autorización de su representante legal, que acepta estos documentos y los datos de salud en su nombre.',
      ],
    },
    {
      title: '11. Cambios en esta política',
      paragraphs: [
        'Si esta política cambia de forma sustancial, se publicará una nueva versión en la aplicación y se pedirá una nueva aceptación cuando corresponda.',
      ],
    },
  ],
}

export const STORAGE: LegalDocument = {
  slug: 'almacenamiento',
  title: 'Cookies y almacenamiento local',
  version: '1.0',
  updatedAt: '2026-10-15',
  sections: [
    {
      title: '1. Qué usamos',
      paragraphs: [
        'La aplicación no usa cookies de publicidad, de analítica ni de redes sociales, y no rastrea al usuario entre sitios o aplicaciones.',
        'Solo guarda en el dispositivo la información técnica estrictamente necesaria para funcionar. Por eso no se muestra un aviso de aceptación de cookies.',
      ],
    },
    {
      title: '2. Qué se guarda en el dispositivo',
      paragraphs: [
        'Sesión: el identificador de la sesión iniciada, para no pedir la contraseña en cada pantalla. Se borra al cerrar sesión.',
        'Borrador del pago: lo escrito en el formulario de pago, para no perderlo al abrir la pantalla del procesador. Dura solo mientras la pestaña o la app está abierta y se borra al cerrar sesión.',
        'Pago en curso: la referencia de un pago en línea pendiente, para confirmarlo al volver a la app.',
        'Preferencias: avisos ya cerrados, ficha pospuesta y acceso con biometría activado o no.',
      ],
    },
    {
      title: '3. Pantalla de pago',
      paragraphs: [
        'Al pagar con tarjeta se abre la pantalla segura de Pagomedios, que puede usar sus propias cookies técnicas según su política. Zona Cero no accede a ellas.',
      ],
    },
    {
      title: '4. Cómo borrarlo',
      paragraphs: [
        'Cerrar sesión borra la sesión y el borrador del pago. También se puede borrar todo desde la configuración del navegador o desinstalando la app.',
      ],
    },
  ],
}

export const REFUND: LegalDocument = {
  slug: 'reembolsos',
  title: 'Política de reembolsos',
  version: '1.0',
  updatedAt: '2026-10-15',
  sections: [
    {
      title: '1. Alcance',
      paragraphs: [
        'Esta política aplica a membresías, planes y pases pagados en la app o en recepción. No afecta los derechos que la Ley Orgánica de Defensa del Consumidor reconoce al socio, que prevalecen sobre este documento.',
      ],
    },
    {
      title: '2. Cuándo se reembolsa',
      paragraphs: [
        'Cobro duplicado o error en el monto: se devuelve el valor cobrado de más.',
        'Cobro no autorizado por el socio: se devuelve el valor completo una vez verificado.',
        'Servicio que Zona Cero no pudo prestar por causa propia (por ejemplo, cierre prolongado del gimnasio): se devuelve la parte no usada o se extiende la vigencia, a elección del socio.',
        'Compras a distancia (app o web): el socio puede ejercer el derecho de devolución en el plazo y las condiciones que fija la Ley Orgánica de Defensa del Consumidor, siempre que no haya empezado a usar el plan.',
      ],
    },
    {
      title: '3. Cuándo no se reembolsa',
      paragraphs: [
        'Planes o pases ya iniciados que el socio decidió no usar, salvo los casos del punto 2.',
        'Días no asistidos dentro de una membresía vigente.',
        'En el pago recurrente, los meses ya cobrados y empezados. Cancelar el pago recurrente detiene los cobros siguientes y no afecta el mes en curso.',
      ],
    },
    {
      title: '4. Cómo solicitarlo',
      paragraphs: [
        `En recepción o por correo a ${CONTACT_EMAIL}, con el nombre del socio, la fecha, el monto y la referencia o el código del pago.`,
        'Zona Cero responderá en un máximo de 15 días. Si procede, el reembolso se hace por el mismo medio del pago: los pagos con tarjeta se reversan a través de Pagomedios y el banco puede tardar en reflejarlos según sus tiempos; los pagos en efectivo o por transferencia se devuelven por transferencia.',
      ],
    },
  ],
}

/** Términos y condiciones en el mismo formato, para la página pública. */
export const TERMS_DOCUMENT: LegalDocument = {
  slug: 'terminos',
  title: TERMS.title,
  version: TERMS.version,
  updatedAt: '2026-10-12',
  sections: TERMS.sections,
}

export const LEGAL_DOCUMENTS = [TERMS_DOCUMENT, PRIVACY, REFUND, STORAGE]

export function legalPath(doc: Pick<LegalDocument, 'slug'>) {
  return `/legal/${doc.slug}`
}
