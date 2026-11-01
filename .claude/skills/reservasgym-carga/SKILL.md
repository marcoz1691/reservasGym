---
name: reservasgym-carga
description: Ejecuta y analiza las pruebas de carga k6 de ReservasGym (escenarios a y b, integridad, SLO). Úsalo cuando el usuario hable de carga, k6, rendimiento, concurrencia de reservas, SLO o usuarios de prueba masivos.
allowed-tools: Read, Grep, Glob, Bash
---

# Pruebas de carga

Documentación en `app/load/README.md`, objetivos en `app/load/slo.md`, inventario en `app/load/inventory.md`. Requiere `app/.env.load.local` (no lo crees ni lo imprimas).

Orden, desde `app/`:

1. `npm run load:seed` — crea usuarios de prueba.
2. `npm run load:mint` — genera tokens.
3. `npm run load:a` o `npm run load:b` — escenarios k6.
4. `npm run load:check` — verifica integridad de datos.
5. `npm run load:cleanup` — **borra** los usuarios de prueba. Confirma con el usuario el entorno (staging vs producción) antes de sembrar o limpiar.

Compara resultados con `slo.md` y reporta cumplimiento por métrica. Reportes quedan en `app/load/reports/`.
