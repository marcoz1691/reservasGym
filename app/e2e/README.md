# Pruebas E2E (Playwright)

Prueban la app **real de QA** (`https://zona-cero-qa.vercel.app` + Supabase QA) como la usa una persona: navegador emulando un iPhone 13, en español y con hora de Ecuador. Cada paso se verifica en la pantalla y en la base de datos.

Complementan a los tests de Vitest (`npm test`), que prueban el código en aislamiento. Estas pruebas atrapan lo que solo falla con todo junto: el deploy, Supabase, la zona horaria o permisos mal aplicados.

## Qué cubren

| Archivo | Tickets | Qué prueba |
|---|---|---|
| `recuperacion-otp.e2e.ts` | ZCAPP-61 | Recuperar la contraseña con el código de 6 dígitos: validaciones, reenvío bloqueado 60 s, código incorrecto, cambio y login con la clave nueva, código de un solo uso |
| `medidas.e2e.ts` | ZCAPP-22, 23, 52, 62 | Medición con coma decimal, IMC en vivo (70.5 kg / 175 cm = 23.0), gráfica, historial, meta, staff registrando medidas y hora de Ecuador al guardar |
| `reservas-checkin.e2e.ts` | ZCAPP-21, 24, 56 | Reservar, solapamiento, lista de espera, promoción al liberarse cupo, cancelar, QR con código corto, check-in (código incorrecto, correcto, doble, fuera de horario) |

## Cómo correrlas

```bash
cd app
npx playwright install chromium          # solo la primera vez
export SUPABASE_ACCESS_TOKEN="sbp_..."   # token de Supabase (el mismo de provision-staging)
export E2E_SUPABASE_ANON_KEY="eyJ..."    # opcional: anon key de QA (prueba de "código de un solo uso")
npm run test:e2e
```

El reporte HTML queda en `e2e/report/` (`npx playwright show-report e2e/report`). Si algo falla, en `e2e/results/` hay capturas y la traza paso a paso.

| Variable | Obligatoria | Para qué |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Sí | Preparar escenarios, verificar lo guardado y limpiar (API de gestión de Supabase) |
| `E2E_SUPABASE_ANON_KEY` | No | Probar que el código de recuperación no se reutiliza |
| `E2E_BASE_URL` | No | Otra URL (por defecto QA) |
| `E2E_PASSWORD` | No | Contraseña de las cuentas staging (por defecto la documentada) |

## Seguridad y datos

- **Solo QA.** `support/qa.ts` se niega a correr si el proyecto de Supabase es el de producción.
- **No dejan basura.** Las clases de prueba se llaman `QA-E2E …` y se borran al final junto con sus reservas, colas y check-ins. Las medidas y metas del socio se restauran como estaban.
- **Cuentas:** `socio.staging`, `staff.staging` y `admin.staging`. La prueba de recuperación cambia la clave del socio a una temporal y al final restaura la documentada.
- Corren en serie (`workers: 1`) porque comparten cuentas y datos de QA.

## Cuándo correrlas

- Después de cada merge a `main`, cuando QA ya tiene el deploy nuevo, y antes de pasar tickets a *Finalizado*.
- Antes de publicar a producción (actualizar la rama `production`).
