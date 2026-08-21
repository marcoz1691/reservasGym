# Plan comercial — ReservasGym (Ecuador)

> Documento de venta y precios. Todas las cifras están en **USD** (moneda oficial de Ecuador) y **no incluyen IVA 15%**.
> Última revisión: agosto 2026.

---

## 1. Contexto de mercado (Ecuador)

- **Moneda:** USD. No hay riesgo cambiario, pero sí alta sensibilidad al precio.
- **Impuestos:** IVA 15%. Facturación electrónica obligatoria ante el SRI (se factura con RUC).
- **Retenciones:** si el cliente es agente de retención, descontará en la fuente (IR 2,75%–10% según el tipo de servicio e IVA 30%/70%). Proyectar el flujo de caja con eso en mente.
- **Perfil de cliente objetivo:**
  - Gimnasio de barrio / tradicional: 250–600 socios, mensualidad $25–$40.
  - Box de CrossFit o estudio boutique (funcional, spinning, yoga, pilates): 120–250 socios, mensualidad $50–$80. **Es el mejor segmento**: viven de clases con cupo limitado, que es exactamente lo que resuelve el producto.
  - Centro deportivo / club con piscina, sauna y canchas: la gestión de zonas por franjas es su mayor dolor.
  - Cadenas de 2–5 sedes en Quito, Guayaquil, Cuenca, Ambato, Manta y Loja.
- **Cómo operan hoy:** WhatsApp + cuaderno + Excel. Las consecuencias medibles son sobreventa de cupos, colas en recepción, no-shows sin control y cero datos de ocupación.
- **Competencia:** Mindbody (desde ~$139/mes, en inglés, soporte fuera de zona horaria), Trainingym y Bsport (España), Fitco (LatAm, $80–$250/mes). Ninguno vende implementación local con soporte en español y horario Ecuador. **Ese es el diferencial.**
- **Estacionalidad:** el pico de inscripciones es enero. El ciclo de venta ideal es **prospectar en octubre–noviembre, implementar en diciembre, arrancar en enero**. Segundo pico menor en junio–julio.

---

## 2. Dos modelos de comercialización

### Modelo A — SaaS: implementación + mensualidad (**recomendado**)

El gimnasio no compra el software: paga una implementación única y una suscripción. Baja la barrera de entrada, genera ingreso recurrente (MRR) y deja la puerta abierta a upsells. **Es el modelo por defecto en toda propuesta.**

### Modelo B — Desarrollo a medida por fases

El gimnasio paga por fases entregables y recibe licencia de uso perpetua (y opcionalmente el código fuente). Se usa solo cuando el cliente exige ser dueño de la solución o es una cadena grande. El precio total es más alto y el mantenimiento se contrata aparte.

---

## 3. Modelo A — Planes Básico / Intermedio / Avanzado

| | **BÁSICO — "Reserva"** | **INTERMEDIO — "Gestiona"** ⭐ | **AVANZADO — "Escala"** |
|---|---|---|---|
| **Para quién** | Gimnasio de 1 sede que solo necesita ordenar los cupos | Gimnasio o box con clases, membresías y staff | Cadena multi-sede o centro deportivo completo |
| **Implementación (único)** | **$890** | **$1.890** | **$3.900** |
| **Mensualidad** | **$69/mes** | **$149/mes** | **$299/mes** |
| **Pago anual (10 meses)** | $690/año | $1.490/año | $2.990/año |
| **Sedes** | 1 | Hasta 2 | Ilimitadas |
| **Socios activos** | Hasta 300 | Hasta 1.000 | Ilimitados |
| **Usuarios de staff** | 3 | 10 | Ilimitados |
| **Soporte** | Email, 48 h hábiles | Email + WhatsApp, 24 h hábiles | Prioritario 8 h, SLA 99,5% |

### Qué incluye cada plan

**BÁSICO — "Reserva" · $890 + $69/mes**

- Registro e inicio de sesión del socio (email/contraseña y Sign in with Apple).
- Perfil del socio con su plan/membresía activa.
- Catálogo de clases y zonas (pesas, cardio, funcional, spinning, piscina, sauna, cancha) con buscador y filtros.
- Agenda con vista **día y semana**, con cupo disponible en cada slot.
- Reservar y cancelar con política de tiempo mínimo configurable.
- **Lista de espera automática** cuando la clase se llena, con promoción al liberarse un cupo.
- **Check-in con código QR** desde el celular del socio.
- "Mis reservas": próximas, historial y estados (confirmada, pendiente, cancelada, no-show).
- Panel de administración: alta/baja/edición de clases, zonas, instructores y aforos.
- Reporte básico de ocupación.
- App **responsive** (celular, tablet y computador), modo claro/oscuro, en español.
- Personalización de marca: logo y colores del gimnasio.
- Hosting, dominio incluido tipo `tugimnasio.app`, respaldos diarios y actualizaciones de mantenimiento.
- 1 sesión de capacitación (2 h) y carga inicial del catálogo.

**INTERMEDIO — "Gestiona" · $1.890 + $149/mes** *(el más vendido)*

Todo lo del Básico, más:

- Vista de calendario **mes** además de día y semana.
- **Reservas recurrentes** (ej. "spinning todos los martes y jueves 19:00").
- **Reagendar en un toque** desde "Mis reservas".
- Control de **no-shows** con penalizaciones y bloqueo temporal configurable.
- Gestión de **membresías y planes**: vigencias, vencimientos, alertas de renovación y control de acceso por tipo de plan.
- Perfiles de **entrenadores con valoraciones** de los socios.
- **Favoritos** y **noticias del club**.
- **Notificaciones push web y recordatorios automáticos** (antes de la clase, aviso de lista de espera, aviso de cancelación).
- **Bloqueos por mantenimiento** de zonas, con cancelación en cascada y aviso a los afectados.
- Reportes de ocupación y asistencia **exportables a CSV/PDF**.
- **Importación de socios desde Excel**.
- 2 sesiones de capacitación y acompañamiento durante el primer mes.

**AVANZADO — "Escala" · $3.900 + $299/mes**

Todo lo del Intermedio, más:

- **Multi-sede** con reportes consolidados y comparativos entre locales.
- **Rutinas y seguimiento de progreso** del socio.
- **Métricas del socio**: asistencias, racha (streak), calorías estimadas.
- **Entrenamiento personal** con agenda propia por entrenador.
- **Roles y permisos granulares** (recepción, instructor, gerente, dueño).
- **Modo tótem/kiosko** para check-in con QR en la entrada.
- **PWA instalable** con dominio propio (ícono en la pantalla de inicio, se ve y se siente como app).
- **Dashboard ejecutivo** con KPIs: ocupación por franja, retención, clases más y menos rentables, horas valle.
- **API y webhooks** para conectar con otros sistemas.
- Recordatorios por **WhatsApp** (integración lista; el costo de los mensajes lo asume el cliente directamente con el proveedor).
- 1 personalización menor incluida por trimestre.

**ENTERPRISE — a cotizar (desde $12.000 + $499/mes)**

Cadenas con más de 5 sedes, integraciones con ERP o control de acceso físico, requisitos de infraestructura propia, acuerdos de nivel de servicio a medida y desarrollo dedicado.

### Opción alternativa: precio por socio activo

Para gimnasios que crecen rápido o que prefieren un costo variable:

**$0,45 por socio activo/mes, con mínimo de $79/mes.** Solo se cobra por el socio que efectivamente usó la app en el mes. Es una excelente respuesta a la objeción "no sé cuántos van a usarla".

---

## 4. Modelo B — Precio por fases (desarrollo a medida)

Para el cliente que quiere pagar por partes o ser dueño de la solución. Cada fase se entrega **funcionando y usable**, no como avance parcial.

| Fase | Qué recibe el cliente | Precio |
|---|---|---|
| **0. Diagnóstico y demo personalizada** | Levantamiento de horarios, zonas e instructores + demo cargada con SUS datos reales | **$0** (o $150 acreditables si exige informe escrito) |
| **1. Fundación** | Identidad visual, sistema de diseño, registro/login, perfil y membresía del socio | **$650** |
| **2. Catálogo y agenda** | Clases y zonas con buscador y filtros, detalle con aforo, calendario día/semana/mes | **$900** |
| **3. Motor de reservas** | Reservar, cancelar, reagendar, recurrentes, lista de espera, check-in con QR, "Mis reservas" | **$1.250** |
| **4. Fidelización** | Notificaciones y recordatorios, rutinas y progreso, métricas, entrenadores y valoraciones, noticias, favoritos | **$850** |
| **5. Panel de administración** | CRUD completo, aforos, bloqueos por mantenimiento, reportes de ocupación exportables | **$1.100** |
| **6. Escalamiento** | Multi-sede, tótem de check-in, roles y permisos, API y dashboard ejecutivo | **$1.400** |
| **7. Cobros (futuro)** | Pasarela de pagos y facturación electrónica SRI — *fuera del alcance actual* | **$2.600** |

- **Fases 1 a 3 (producto mínimo vendible): $2.800.** Es el paquete de entrada más común.
- **Fases 1 a 5 (producto completo): $4.750.** Precio cerrado promocional: **$4.300**.
- **Fases 1 a 6: $6.150.** Precio cerrado: **$5.500**.
- **Mantenimiento obligatorio posterior:** $89/mes (hosting, respaldos, actualizaciones y soporte). Sin él, la garantía se limita a 90 días.
- **Entrega del código fuente:** +40% sobre el total del proyecto.

> **Regla de venta:** el precio por fases siempre suma más que el paquete cerrado equivalente. Es intencional: premia al cliente que compra completo y le da al vendedor una palanca de cierre real ("si lo cierras hoy completo, te ahorras $450").

---

## 5. Ventas adicionales (upsell y cross-sell)

Estos módulos se ofrecen **a partir del tercer mes de uso**, cuando el cliente ya vio resultados. Es cuando mejor convierten.

| Complemento | Implementación | Mensual |
|---|---|---|
| **Pasarela de pagos y cobro recurrente** (Payphone, DeUna, Datafast, Kushki) | $1.200 | $39/mes |
| **Facturación electrónica SRI** | $1.400 | $45/mes |
| **App nativa iOS y Android** publicada en las tiendas | $1.500–$4.500 | $49/mes |
| **Control de acceso** (torniquete, QR o huella) — hardware aparte | $900 | $25/mes |
| **Recordatorios por WhatsApp** (API oficial) | $450 | $29/mes + costo de mensajes |
| **Módulo de nutrición y planes alimenticios** | $700 | — |
| **Retos y gamificación** (rankings, insignias, temporadas) | $900 | $19/mes |
| **Reportes BI avanzados** / conexión a Looker Studio | $600 | $19/mes |
| **Migración de datos** desde Excel u otro sistema | $250–$600 | — |
| **Diseño de marca profundo** (más allá de logo y colores) | $450 | — |
| **Soporte extendido 24/7** | — | +$99/mes |
| **Capacitación adicional** | $80 por sesión de 2 h | — |
| **Bolsa de horas de evolución** | 10 h por $450 · 20 h por $800 | — |
| **Sede adicional** (planes Básico e Intermedio) | $350 | +$49/mes |

> **Costos que asume el cliente directamente** (declararlo desde el principio para evitar fricción): cuenta de desarrollador de Apple $99/año y de Google $25 pago único si contrata app nativa; comisiones de la pasarela de pagos; costo por mensaje de WhatsApp.

---

## 6. Condiciones comerciales

- **Contrato mínimo:** 12 meses en Modelo A. Renovación automática con aviso de 30 días.
- **Formas de pago de la implementación:** 50% al firmar y 50% a la entrega; o 3 cuotas sin interés.
- **Alternativa "sin entrada":** implementación en $0 con contrato a 18 meses y mensualidad +30%. Convierte muy bien con gimnasios pequeños que no tienen caja para el setup.
- **Prueba piloto:** 30 días gratis limitado a 1 sala o 3 clases. Sin tarjeta, sin compromiso.
- **Garantía:** 90 días de corrección de errores sin costo tras cada entrega.
- **Descuentos autorizados:**
  - Pago anual anticipado: 2 meses gratis (ya reflejado en la tabla).
  - Cliente fundador (primeros 5 gimnasios): −25% en implementación a cambio de testimonio, caso de éxito y derecho a usar su marca como referencia.
  - Referido que cierra: 1 mes gratis para quien refiere.
  - Máximo descuento del vendedor sin autorización: **15%**.
- **Reajuste anual:** hasta 8% en la renovación, avisado con 60 días.
- **Propiedad de los datos:** son del gimnasio. Exportación completa en CSV a solicitud y al terminar el contrato.

---

## 7. Argumento de venta y retorno de inversión

**El pitch en una frase:** *"Deja de perder cupos y de contestar WhatsApps: tus socios reservan solos, tú ves en tiempo real qué clases se llenan y cuáles no."*

**Los tres dolores que se atacan, en orden de impacto:**

1. **No-shows.** Sin recordatorios ni política de cancelación, entre el 15% y el 25% de los cupos reservados se pierden. Cada cupo liberado a tiempo es un socio satisfecho que sí entra.
2. **Recepción saturada.** Una recepcionista en Ecuador cuesta ~$550/mes con beneficios. El plan Intermedio cuesta $149/mes y absorbe la reserva, la cancelación y el reagendamiento.
3. **Cero visibilidad.** Nadie sabe qué franjas están vacías. Con el reporte de ocupación se rediseñan horarios y se llenan las horas valle.

**Ejemplo de ROI para un gimnasio de 400 socios a $35/mes ($14.000/mes de facturación):**

- Costo del plan Intermedio: $149/mes = **1,1% de la facturación**.
- Con retener apenas **5 socios adicionales al mes** gracias a una mejor experiencia, se recuperan $175/mes. El sistema ya se pagó solo.
- Todo lo demás (menos carga en recepción, mejor ocupación en horas valle, datos para decidir) es ganancia.

**Comparativo para la propuesta:** Mindbody arranca en ~$139/mes en inglés y con soporte en otra zona horaria; Fitco y Trainingym van de $80 a $250/mes sin implementación local. Nuestro plan Intermedio queda en $149/mes **con implementación, capacitación presencial y soporte en español en horario Ecuador**.

---

## 8. Proceso de venta

1. **Prospección.** Instagram y visita en frío a boxes de CrossFit, estudios boutique y centros deportivos de Quito, Guayaquil, Cuenca, Ambato y Manta. El decisor es el dueño o el gerente, casi nunca recepción.
2. **Demo con sus propios datos.** Antes de la reunión, cargar el horario real del gimnasio (está publicado en su Instagram) en la app. Ver su propia parrilla de clases funcionando cierra más que cualquier presentación.
3. **Piloto de 30 días** con una sola sala o clase. Bajo riesgo, alta conversión.
4. **Cierre** con contrato a 12 meses. Ofrecer siempre el plan Intermedio como opción central; el Básico existe para hacerlo ver razonable y el Avanzado para anclar el precio hacia arriba.
5. **Onboarding en 2 semanas**: carga de catálogo, importación de socios, capacitación y lanzamiento con material de comunicación para los socios (afiche con QR y guion para redes).
6. **Upsell al mes 3–6**: pagos, app nativa y control de acceso, ya con datos de uso reales en la mano.

### Manejo de objeciones

| Objeción | Respuesta |
|---|---|
| "Está caro" | Comparar con el costo mensual de una recepcionista y con el valor de los cupos perdidos por no-show. Ofrecer la modalidad sin entrada a 18 meses. |
| "Ya manejo todo por WhatsApp" | WhatsApp no le dice cuántos cupos quedan ni quién no vino. Mostrar el reporte de ocupación. |
| "Mis socios son mayores, no van a usar una app" | El check-in con QR en el tótem lo hace la recepción. La app es opcional para el socio y obligatoria solo para el staff. |
| "¿Y si se cae el internet?" | La app funciona con datos en caché y los reportes son exportables. El check-in tiene respaldo manual. |
| "Quiero ser dueño del sistema" | Pasar al Modelo B por fases, con entrega de código fuente por +40%. |
| "Déjame pensarlo" | Activar el piloto gratuito de 30 días en ese mismo momento. Sin decisión de compra, no hay nada que pensar. |

---

## 9. Proyección de ingresos (referencia)

Escenario conservador para el primer año, con una mezcla de 2 clientes Básico, 6 Intermedio y 1 Avanzado:

- **Implementaciones:** (2 × $890) + (6 × $1.890) + (1 × $3.900) = **$19.020** de ingreso único.
- **Recurrente mensual:** (2 × $69) + (6 × $149) + (1 × $299) = **$1.331/mes** = $15.972/año.
- **Upsells estimados** (30% de la base contrata pagos o app nativa al año siguiente): ~$4.000 adicionales.

El valor real del negocio está en el MRR: 20 clientes en el plan Intermedio son $2.980/mes recurrentes sin trabajo nuevo de desarrollo.

---

## 10. Nota sobre pagos en línea

**La pasarela de pagos y la facturación electrónica quedan explícitamente fuera del alcance de la versión actual del producto.** La app gestiona membresías, planes, vigencias y visualización de facturas, pero no procesa cobros.

Se comercializan como **Fase 7 / complemento posterior** (ver sección 5). Esto es deliberado y conviene comercialmente: permite lanzar antes, evita el trámite de afiliación a la pasarela durante la venta inicial y deja un upsell claro de $1.200 + $39/mes para el mes 3–6, cuando el cliente ya confía en el sistema.
