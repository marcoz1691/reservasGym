# ReservasGym

Aplicación de reservas, control de aforo y asistencia para gimnasios, más el material comercial para venderla en Ecuador.

Los socios reservan, cancelan, reagendan y hacen check-in con código QR en clases y zonas del gimnasio (pesas, cardio, funcional, spinning, piscina, sauna, cancha y entrenamiento personal). El staff administra horarios, aforos, instructores y bloqueos por mantenimiento.

---

## Estado del repositorio

| Área | Estado |
|---|---|
| Material comercial (plan de ventas, presentación, guía de prospectos) | **Listo para usar** |
| Plan técnico (stack, arquitectura, modelo de datos, fases) | **Definido y documentado** |
| Aplicación | **Pendiente de implementar**, arranca en la fase 1 |

---

## Estructura

```
docs/
  comercial/
    plan-comercial.md              Planes, precios, canal de socios, objeciones, ROI
    presentacion/
      ReservasGym-Presentacion.pdf El deck para enviar al cliente por WhatsApp
      slides/01.jpg ... 14.jpg     Cada lamina como imagen 1920x1080
      mensajes-whatsapp.md         Textos listos para copiar y pegar
      presentacion.html            Deck fuente, aqui se edita el contenido
      render.mjs                   Exporta el HTML a PDF e imagenes
      README.md                    Como personalizar y regenerar el deck
    prospectos/
      william-ramirez.md           Guia de descubrimiento del primer prospecto
  tecnico/
    plan-de-desarrollo.md          Stack, arquitectura, modelo de datos y fases
```

---

## Material comercial

### Presentación para el cliente

El entregable principal es `docs/comercial/presentacion/ReservasGym-Presentacion.pdf`: 14 láminas en formato 16:9, escritas en lenguaje de usuario final, listas para enviar por WhatsApp o correo.

**Antes de enviarla a un cliente** hay que reemplazar los datos de contacto de la lámina 14 y personalizar la portada con el nombre del gimnasio. El procedimiento completo está en [docs/comercial/presentacion/README.md](docs/comercial/presentacion/README.md).

Para regenerar el PDF y las imágenes después de editar el deck:

```bash
cd docs/comercial/presentacion
npm install
npm run render
```

Requiere Node 18 o superior y Google Chrome instalado. No descarga ningún navegador: usa el del sistema. Si Chrome está en una ruta no estándar, pásala con `CHROME_PATH="/ruta/a/google-chrome" npm run render`.

### Plan de ventas

[docs/comercial/plan-comercial.md](docs/comercial/plan-comercial.md) tiene los tres modelos de comercialización, los planes Básico, Intermedio y Avanzado con su alcance y precio, el canal de socios comerciales, el catálogo de complementos, las condiciones comerciales, el argumento de retorno de inversión, el proceso de venta y el manejo de objeciones.

Resumen de precios, en dólares y sin IVA:

| Plan | Implementación | Mensual |
|---|---|---|
| Básico | $890 | $69 |
| Intermedio (recomendado) | $1.890 | $149 |
| Avanzado | $3.900 | $299 |

**Si cambias un precio, cámbialo también en `presentacion.html` y vuelve a exportar el deck.**

---

## La aplicación

Todavía no está implementada. El plan completo (decisión de stack y su justificación, arquitectura por capas, modelo de datos, reglas de negocio, mapa de pantallas, accesibilidad y fases de construcción) está en [docs/tecnico/plan-de-desarrollo.md](docs/tecnico/plan-de-desarrollo.md).

En resumen: aplicación web con React 19, TypeScript en modo estricto, Vite y Tailwind CSS v4, con separación estricta entre interfaz, dominio y datos, y una capa de datos desacoplada con seed realista para poder ejecutarla sin backend.

### Decisiones de producto ya tomadas

- **No hay pasarela de pagos.** El módulo de membresía muestra plan, vigencia y facturas, pero no procesa cobros. Se vende como complemento posterior.
- **Se distribuye como aplicación web instalable (PWA)**, no como app nativa. Se instala en el celular con su ícono, sin pasar por App Store ni Google Play. La publicación en tiendas es un complemento comercial aparte.
- **Incluye control de peso y medidas** del socio (peso, medidas corporales, IMC, metas y evolución) dentro del plan Avanzado.

---

## Cómo continuar el trabajo

El siguiente paso es la **fase 1: base y sistema de diseño**, descrita en la sección 7 del plan de desarrollo. Cada fase debe dejar la aplicación ejecutable, con un commit por cambio lógico.
