# QA en dispositivos — Pago en línea (Pagomedios) + smoke de la app

**Rama:** `feat/pagomedios-pago-unico-v2` (local, sin desplegar)
**Ambiente:** app local (live reload) + base de QA + función `pagomedios-payment` local + sandbox Pagomedios
**Dispositivos:** Android 15 (emulador Pixel 7) · iOS 18.0 (simulador iPhone SE 3.ª gen.)
**Cuenta:** `socio.staging@zonacero.test` / `ZonaCero2026!` · admin `admin.staging@zonacero.test`

Resultado por ítem: PASS | FAIL | BLOCKED (motivo). Columnas: **A** = Android, **i** = iOS.

## 1. Arranque y navegación

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 1.1 | Abrir la app | Login sin errores de consola | PASS | PASS |
| 1.2 | Entrar como socio | Inicio con nombre y plan | PASS | PASS |
| 1.3 | Pestañas Inicio, Reservar, Mis clases, Mi Plan, Medidas | Cada una carga sin error ni pantalla en blanco | PASS | PASS |
| 1.4 | Zonas seguras | Nada queda bajo el notch ni bajo la barra de gestos | PASS* | PASS |

## 2. Checkout — formulario

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 2.1 | Mi Plan → "Elegir/Renovar plan" | Pago a pantalla completa, sin menú inferior | PASS | PASS |
| 2.2 | Escribir letras en cédula y celular | No se aceptan; teclado numérico | PASS | PASS |
| 2.3 | Cédula inválida / celular sin 09 | Mensaje en español bajo el campo | PASS | PASS |
| 2.4 | Datos válidos | Resumen "Cédula … · 09…"; colapsar/expandir conserva lo escrito | PASS | PASS |
| 2.5 | Botón Pagar | Deshabilitado hasta datos válidos + términos | PASS | PASS |
| 2.6 | "términos y condiciones" | Ventana encima; al cerrarla no se pierde nada | PASS | PASS |
| 2.7 | Efectivo / Transferencia | Sin datos del pagador; botón "Confirmar solicitud" | PASS | PASS |

## 3. Salir del pago

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 3.1 | ✕ o ← arriba | Hoja "¿Quieres salir del pago?" | PASS | PASS |
| 3.2 | "Continuar con el pago" | Se cierra la hoja y se conserva lo escrito | PASS | PASS |
| 3.3 | Botón atrás del sistema (Android) | Abre la hoja, no sale | PASS* | n/a |
| 3.4 | "Salir del pago" | Vuelve a Mi Plan; "atrás" no regresa al pago | PASS | PASS |

## 4. Pago con tarjeta (sandbox real)

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 4.1 | Pagar con tarjeta | Formulario de Pagomedios en pantalla dentro de la app ("Pago seguro · Pagomedios") | PASS | PASS |
| 4.2 | Visa de prueba, $15 | Aprobado | PASS | PASS |
| 4.3 | Retorno | La pantalla se cierra sola; comprobante con plan, monto, autorización, vigencia | PASS* | PASS |
| 4.4 | "Ir a Mi Plan" | Plan nuevo, "Membresía activa", vigencia nueva, historial "Tarjeta en línea · Aprobado" | PASS | PASS |
| 4.5 | Cerrar la pantalla de pago antes de pagar | Vuelve a la app y queda "pendiente" con "Volver a verificar" | PASS | PASS |

## 5. Pago en recepción

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 5.1 | Efectivo → Confirmar solicitud | "Solicitud enviada · Paga en recepción" | PASS | PASS |
| 5.2 | Mi Plan | Tarjeta "Solicitud enviada … Efectivo" | PASS | PASS |

## 6. Estabilidad

| # | Paso | Esperado | A | i |
|---|------|----------|---|---|
| 6.1 | Errores de JavaScript en consola durante todo el recorrido | Ninguno propio de la app | PASS | PASS |
| 6.2 | Cierres de la app (crash) | Ninguno | PASS | PASS |

## Ejecución Android — 01-oct-2026

Emulador Pixel 7 · Android 15 (API 35) · WebView Chrome 124. La app se controló con Playwright Android (`_android`) y CDP; el botón atrás y las capturas, con `adb`. El formulario de Pagomedios se completó por CDP (`Input.insertText`, también dentro de los iframes de la tarjeta). Visa de prueba aprobada: autorización `518216`.

**Resultado: 24/24 PASS** después de corregir los hallazgos (*).

## Ejecución iOS — 14-oct-2026

Simulador iPhone SE (3.ª gen.) · iOS 18.0 · app nativa (Capacitor) compilada contra **QA** (`build --mode capacitor` con las variables de `.env.staging.local`) y la función `pagomedios-payment` **desplegada**. La app se controló con Appium 2.19 + XCUITest: contexto `WEBVIEW` para la app y `NATIVE_APP` para la pantalla de pago de `@capgo/inappbrowser`, donde el formulario de Pagomedios se llena por accesibilidad (sus campos de tarjeta están en iframes de otro dominio). Script: `app/e2e/ios/checklist-nativo.mjs`; guía: `docs/tecnico/qa-dispositivos-appium.md`.

**Resultado: 23/23 PASS** (3.3 no aplica en iOS) + **E-03** doble toque en «Pagar» → 1 solo pago.

- 4.2: pago real con la Visa de prueba aprobado (autorización 698270); 4.3: la pantalla se cerró sola y mostró el comprobante (plan, monto, autorización, vigencia).
- 4.4: el socio ya tenía un plan vigente, así que la compra quedó **en cola** («Empieza el 18 de octubre») según las reglas de planes.
- 1.4: menú inferior entre 598 y 667 px de 667 con 12 px de margen inferior; nada bajo la barra de estado (ver capturas).
- 6.1: sin errores de JavaScript capturados en todo el recorrido.
- Al terminar, el script borra los pagos de prueba del socio y restaura sus membresías.

| # | Hallazgo iOS | Severidad | Estado |
|---|--------------|-----------|--------|
| HI1 | El `Podfile` de iOS no incluía `@capacitor/app` (agregado para el botón atrás de Android): el plugin no existía en iOS. | Media | Corregido con `npx cap sync ios` |

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

