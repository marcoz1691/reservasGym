# QA en dispositivos — Pago en línea (Pagomedios) + smoke de la app

**Rama:** `feat/pagomedios-pago-unico-v2` (local, sin desplegar)
**Ambiente:** app local (live reload) + base de QA + función `pagomedios-payment` local + sandbox Pagomedios
**Dispositivos:** Android 15 (emulador Pixel 7) · iOS 18.0 (simulador iPhone 16)
**Cuenta:** `socio.staging@zonacero.test` / `ZonaCero2026!` · admin `admin.staging@zonacero.test`

Resultado por ítem: PASS | FAIL | BLOCKED (motivo). Columnas: **A** = Android, **i** = iOS.

## 1. Arranque y navegación

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 1.1 | Abrir la app | Login sin errores de consola | PASS | |
| 1.2 | Entrar como socio | Inicio con nombre y plan | PASS | |
| 1.3 | Pestañas Inicio, Reservar, Mis clases, Mi Plan, Medidas | Cada una carga sin error ni pantalla en blanco | PASS | |
| 1.4 | Zonas seguras | Nada queda bajo el notch ni bajo la barra de gestos | PASS* | |

## 2. Checkout — formulario

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 2.1 | Mi Plan → "Elegir/Renovar plan" | Pago a pantalla completa, sin menú inferior | PASS | |
| 2.2 | Escribir letras en cédula y celular | No se aceptan; teclado numérico | PASS | |
| 2.3 | Cédula inválida / celular sin 09 | Mensaje en español bajo el campo | PASS | |
| 2.4 | Datos válidos | Resumen "Cédula … · 09…"; colapsar/expandir conserva lo escrito | PASS | |
| 2.5 | Botón Pagar | Deshabilitado hasta datos válidos + términos | PASS | |
| 2.6 | "términos y condiciones" | Ventana encima; al cerrarla no se pierde nada | PASS | |
| 2.7 | Efectivo / Transferencia | Sin datos del pagador; botón "Confirmar solicitud" | PASS | |

## 3. Salir del pago

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 3.1 | ✕ o ← arriba | Hoja "¿Quieres salir del pago?" | PASS | |
| 3.2 | "Continuar con el pago" | Se cierra la hoja y se conserva lo escrito | PASS | |
| 3.3 | Botón atrás del sistema (Android) | Abre la hoja, no sale | PASS* | n/a |
| 3.4 | "Salir del pago" | Vuelve a Mi Plan; "atrás" no regresa al pago | PASS | |

## 4. Pago con tarjeta (sandbox real)

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 4.1 | Pagar con tarjeta | Formulario de Pagomedios en pantalla dentro de la app ("Pago seguro · Pagomedios") | PASS | |
| 4.2 | Visa de prueba, $15 | Aprobado | PASS | |
| 4.3 | Retorno | La pantalla se cierra sola; comprobante con plan, monto, autorización, vigencia | PASS* | |
| 4.4 | "Ir a Mi Plan" | Plan nuevo, "Membresía activa", vigencia nueva, historial "Tarjeta en línea · Aprobado" | PASS | |
| 4.5 | Cerrar la pantalla de pago antes de pagar | Vuelve a la app y queda "pendiente" con "Volver a verificar" | PASS | |

## 5. Pago en recepción

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 5.1 | Efectivo → Confirmar solicitud | "Solicitud enviada · Paga en recepción" | PASS | |
| 5.2 | Mi Plan | Tarjeta "Solicitud enviada … Efectivo" | PASS | |

## 6. Estabilidad

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 6.1 | Errores de JavaScript en consola durante todo el recorrido | Ninguno propio de la app | PASS | |
| 6.2 | Cierres de la app (crash) | Ninguno | PASS | |

## Ejecución Android — 01-oct-2026

Emulador Pixel 7 · Android 15 (API 35) · WebView Chrome 124. La app se controló con Playwright Android (`_android`) y CDP; el botón atrás y las capturas, con `adb`. El formulario de Pagomedios se completó por CDP (`Input.insertText`, también dentro de los iframes de la tarjeta). Visa de prueba aprobada: autorización `518216`.

**Resultado: 24/24 PASS** después de corregir los hallazgos (*).

## Hallazgos

| # | Hallazgo | Severidad | Estado |
|---|----------|-----------|--------|
| H1 | **Android: el botón atrás del sistema cerraba la app** desde cualquier pantalla (faltaba `@capacitor/app`). También impedía la hoja "¿Quieres salir del pago?". | Alta | Corregido: `src/app/androidBackButton.ts` (historial → atrás; sin historial → salir). Reprobado: 3.3 y 3.4 PASS |
| H2 | **Android: hora e iconos de la barra de estado casi invisibles** (iconos claros sobre fondo claro). | Media | Corregido: `windowLightStatusBar` + color de fondo en `styles.xml` |
| H3 | **Android 15: la barra de gestos tapaba las etiquetas del menú inferior** (edge-to-edge; el WebView no informa márgenes). | Media | Corregido: `adjustMarginsForEdgeToEdge: 'auto'` en `capacitor.config.ts` |
| H4 | Comprobante de pago con dos botones iguales ("Ir a Mi Plan" y "Volver a Mi Plan"). | Baja | Corregido: queda solo "Ir a Mi Plan" |
| H5 | Consola: `Cannot read properties of undefined (reading 'triggerEvent')` y `RepositoryProvider missing`. | — | No es de la app: aparecen solo con live reload (Capacitor dispara pause/resume mientras la página recarga; recarga en caliente de Vite). Con carga limpia y navegación completa: 0 errores |
| H6 | La Mastercard de prueba la rechaza el sandbox ("Entidad fuera de línea" / "Tarjeta Invalida"). | — | Del sandbox de Pagomedios; consultar con ellos |

(*) 1.4 revisado en capturas tras H2/H3 · 3.3 tras H1 · 4.3 tras H4.

iOS: pendiente en ZCAPP-63 (Appium XCUITest).

