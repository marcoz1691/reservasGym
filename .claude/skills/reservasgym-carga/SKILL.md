---
name: reservasgym-carga
description: Ejecuta y analiza las pruebas de carga k6 de ReservasGym (escenarios a y b, integridad, SLO). Úsalo cuando el usuario hable de carga, k6, rendimiento, concurrencia de reservas, SLO o usuarios de prueba masivos.
allowed-tools: Read, Grep, Glob, Bash
---

# Pruebas de carga

Documentación en `app/load/README.md`, objetivos en `app/load/slo.md`, inventario en `app/load/inventory.md`. Requiere `app/.env.load.local` (no lo crees ni lo imprimas).

Orden, desde `app/`. `<run>` es un nombre libre de la corrida (letras, números, `.`, `_`, `-`), p. ej. `2026-11-01-smoke`; los reportes van a `app/load/reports/<run>/`.

1. `npm run load:seed` — crea usuarios de prueba (idempotente).
2. `npm run load:mint` — genera tokens. El escenario B los exige.
3. `npm run load:a -- <run>` o `npm run load:b -- <run>` — escenarios k6. Sin `<run>` el script aborta. `SMOKE=1` hace una corrida corta de humo.
4. `npm run load:check -- --run <run>` — verifica integridad de datos. Sin `--run` aborta.
5. `npm run load:cleanup` — **solo simula (dry-run)**: lista qué borraría y no modifica nada. Para borrar de verdad: `npm run load:cleanup -- --yes`. Muestra primero el dry-run al usuario y pide confirmación antes de usar `--yes`.

Por defecto todo apunta a QA. Producción exige `LOAD_TARGET=prod` y `LOAD_PROD_CONFIRM` en la línea de comandos y que prod no tenga usuarios reales (ver `app/load/README.md`). No actives producción por tu cuenta: confirma con el usuario el entorno antes de sembrar o limpiar.

Compara resultados con `slo.md` y reporta cumplimiento por métrica. Reportes quedan en `app/load/reports/`.
