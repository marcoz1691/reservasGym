# TyC en PDF y configuración del administrador

El PDF aprobado está incluido en `public/legal/terminos-zona-cero-v1.pdf`, versión 1.0. Se usa cuando no hay un documento personalizado. El archivo para impresión y entrega al cliente está en `reports/Terminos-Condiciones-Zona-Cero.pdf`.

## Activación en QA o producción

Aplicar `supabase/terms-documents.sql` en el proyecto de destino y desplegar la aplicación. El script agrega las columnas de documento, versión y fecha a `gym_settings` y crea el bucket `legal-documents`, público para consulta de los documentos legales. Solo admin puede subir y eliminar archivos. Las políticas existentes de `gym_settings` restringen la publicación al administrador.

Esta migración está preparada en el repositorio; no se ha ejecutado en un proyecto remoto durante esta revisión. Las pruebas de repositorio remoto utilizan un cliente simulado, por lo que no certifican las políticas de un proyecto desplegado.

## Flujo de uso

En **Admin → Personalización → Términos y condiciones**, seleccionar un PDF, indicar la versión y pulsar **Publicar PDF**. El administrador puede consultar el documento publicado o volver al incluido. Se validan extensión, tipo, cabecera y tamaño máximo de 5 MB. Cada carga usa una ruta distinta y conserva los archivos anteriores; si falla el guardado de la configuración se intenta limpiar únicamente el nuevo archivo.

En el checkout, **términos y condiciones** muestra la versión y los enlaces **Abrir PDF para imprimir** y **Descargar PDF**. El contenido incluido se muestra como texto justificado; un documento personalizado se consulta mediante el PDF, sin mostrar el texto de otra versión. Una actualización del documento invalida la aceptación del formulario y la aceptación recuperada de un borrador anterior.

La asociación de documento y aceptación en este cambio protege el estado del formulario. No crea un historial persistente de aceptación por pago en la base de datos.

## Comprobación tras desplegar

- Admin publica un PDF válido con versión nueva; el socio consulta ese archivo desde el pago.
- Staff y socio no pueden escribir en `gym_settings` ni cargar o eliminar PDFs mediante Storage.
- Un PDF inválido o mayor de 5 MB no cambia el documento publicado.
- Al cambiar el PDF, un formulario o borrador con aceptación anterior exige aceptar el documento actual.
- El PDF se abre o descarga en navegador de escritorio y en los dispositivos móviles utilizados por el cliente.

## Regeneración del documento incluido

Ejecutar desde `app`: `python3 reports/generar-terminos.py`, `node scripts/sync-terms-content.mjs` y `node scripts/render-terms-pdf.mjs`. Estos comandos actualizan el HTML, el texto incluido en la app y el PDF. La modificación del texto incluido debe acompañarse de una versión y una ruta nuevas cuando se publique una revisión del documento.
