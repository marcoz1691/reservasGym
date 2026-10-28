# QA en el simulador iOS con Appium

Cómo correr el checklist de dispositivos (`docs/tecnico/qa-checklists/PAGOMEDIOS-dispositivos.md`, columna **i**) sobre la app nativa en el simulador de iPhone. El script es `app/e2e/ios/checklist-nativo.mjs`: marca PASS/FAIL por ítem, guarda capturas y al final borra los pagos de prueba del socio y restaura sus membresías en QA.

## Qué se necesita (una sola vez)

| Pieza | Dónde | Nota |
|---|---|---|
| Xcode 16 + simulador iOS 18 | App Store | `xcrun simctl list devices` |
| Ruby 3.4 + CocoaPods | `~/.local/ruby/portable-ruby/3.4.5`, `~/.local/gems` | El Ruby del sistema (2.6) no sirve para `pod` |
| Appium 2 + driver XCUITest | `~/.local/appium`, `APPIUM_HOME=~/.local/appium/home` | `appium driver list --installed` |
| Token de Supabase | `~/.supabase-token` | Para verificar y limpiar datos en QA |
| Visa de prueba de Pagomedios | `app/.env.local` (bloque `Visa:`) | La misma que usan las pruebas E2E |

## 1. Compilar la app contra QA

Desde `app/`:

```bash
set -a && . ./.env.staging.local && set +a && unset VITE_FUNCTIONS_URL
npx tsc -b && npx vite build --mode capacitor          # base './' y Supabase de QA
export PATH="$HOME/.local/ruby/portable-ruby/3.4.5/bin:$HOME/.local/gems/bin:$PATH" \
       GEM_HOME="$HOME/.local/gems" GEM_PATH="$HOME/.local/gems" LANG=en_US.UTF-8
npx cap sync ios
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "id=<UDID>" -derivedDataPath /tmp/zc-ios-build -jobs 4 build
xcrun simctl install <UDID> /tmp/zc-ios-build/Build/Products/Debug-iphonesimulator/App.app
```

- `unset VITE_FUNCTIONS_URL`: en un build la app usa la función **desplegada** en QA.
- `-jobs 4` evita saturar la Mac (sin límite, la carga pasó de 100).
- `<UDID>`: `xcrun simctl list devices booted`.

## 2. Arrancar Appium y WebDriverAgent

En una terminal propia, que queda abierta:

```bash
APPIUM_HOME=~/.local/appium/home ~/.local/appium/node_modules/.bin/appium --port 4723 --log ~/appium.log --log-timestamp
```

La primera sesión compila **WebDriverAgent** (WDA) y lo deja corriendo en el simulador en el puerto 8100. Esa compilación tarda más de 5 minutos y el servidor de Appium corta la petición de sesión a los 5 minutos: si falla, se espera a que termine (`curl localhost:8100/status` responde) y se vuelve a intentar. Desde ahí el script se conecta al WDA ya corriendo con `webDriverAgentUrl` y la sesión arranca en segundos.

## 3. Correr el checklist

Desde `app/`:

```bash
IOS_UDID=<UDID> E2E_PASSWORD='<clave del socio staging>' node e2e/ios/checklist-nativo.mjs /tmp/zc-ios-qa
```

Variables opcionales: `APPIUM_URL` (por defecto `http://localhost:4723`) y `WDA_URL` (por defecto `http://localhost:8100`). Resultado en consola (`RESUMEN …`), en `resultados.json` y en las capturas de la carpeta indicada.

## Capabilities

| Capability | Valor | Por qué |
|---|---|---|
| `bundleId` | `com.reservasgym.zonacero` | La app instalada |
| `webDriverAgentUrl` | `http://localhost:8100` | Usa el WDA ya corriendo, sin recompilar |
| `waitForQuiescence` / `waitForIdleTimeout` | `false` / `0` | Sin esto WDA espera 240 s a que la pantalla «quede quieta» y falla |
| `autoWebview` | `true` | La sesión empieza en el contexto de la app (WebView) |
| `autoFillPasswords` | `false` | Evita el diálogo «¿Guardar contraseña?» de iOS |

## Contextos: WEBVIEW y NATIVE_APP

- **`WEBVIEW_…`**: el HTML de la app. Se busca y se escribe con JavaScript (`execute/sync`) y se toca con `element/…/click`.
- **`NATIVE_APP`**: todo lo que dibuja iOS, incluida la pantalla de pago de `@capgo/inappbrowser`. El formulario de Pagomedios tiene la tarjeta en iframes de otro dominio: desde la app no se pueden tocar, pero XCUITest los ve por accesibilidad («Número de la tarjeta», «Nombre en tarjeta», «Expira», «Security Code CVV»; la marca es un `XCUIElementTypeSwitch` «Visa»).
- Cambiar de contexto: `GET /contexts` y `POST /context {name}`.

## Lecciones aprendidas

- **Campos de React:** `clear()` no avisa a React y el valor viejo vuelve. Se vacían con el setter nativo y un evento `input`, y luego se escribe.
- **Borrador del checkout:** la app recuerda lo escrito, incluida la casilla de términos; se marca solo si está desmarcada.
- **Elementos ocultos:** con la pantalla de pago abierta, los campos del checkout siguen en el árbol nativo con `visible = false`. Filtrar siempre con `visible == 1`.
- **Teclado:** tapa el botón «Pagar» de Pagomedios. Cerrar con «Done» y deslizar (`mobile: swipe`) hasta verlo.
- **Puertos:** WDA usa el 8100. Para las E2E de pagos con la función local usar otro (`E2E_FN_PORT=8200`).
- **Playwright WebKit** no sirve en macOS 14 (su WebKit ya no se actualiza): para Safari/iOS usar este simulador.
