# Flujo del Board Jira — Zona Cero

Proyecto: [ZCAPP — Zona Cero Performance Center](https://marcs-apps-intelligence.atlassian.net/jira/software/projects/ZCAPP/boards/1)

## Columnas

```
Por hacer → En curso → En revisión → Listo para pruebas → Finalizado
```

| Columna | Significado | Quién mueve |
|---------|-------------|-------------|
| **Por hacer** | En sprint, sin iniciar | PM / Dev |
| **En curso** | Desarrollo activo | Dev |
| **En revisión** | Código listo, revisión rápida (opcional) | Dev |
| **Listo para pruebas** | DoD dev cumplido; pendiente validación | Dev → PM valida → Finalizado |
| **Finalizado** | Aceptado | PM |

## Dónde probar (por ambiente)

Ver [staging-setup.md](./staging-setup.md).

- **Sprint 1–5:** local + Supabase staging (`npm run dev:staging`)
- **Sprint 6+:** URL staging desplegada + E2E en dispositivos
- **Sprint 7:** producción

## Plantilla comentario al pasar a «Listo para pruebas»

```markdown
### Listo para pruebas
**Comando:** `cd app && npm run dev:staging`
**Usuario:** socio.staging@zonacero.test (la contraseña de QA está en las notas del equipo, no en el repositorio)

**Checklist:**
- [ ] ...
- [ ] ...

**Evidencia:** (screenshot / video / PR)
```

## Etiquetas y sprints

- `sprint-N` indica el sprint del cronograma (`docs/tecnico/cronograma-desarrollo-avanzada.md` §5); `wbs-1.x.y` la actividad del WBS; `bug`, `qa`, `staging`, `pagomedios` el tema.
- El board solo muestra lo que está en el **sprint activo**: un ticket sin sprint no aparece en las columnas.
- Cerrar un sprint y crear el siguiente se hace en Jira (Backlog → Completar sprint). Al cerrarlo, los tickets abiertos pasan al siguiente sprint o al backlog.
- Estados disponibles en las transiciones: Por hacer, En curso, En revisión, Listo para pruebas, Finalizado.

## JQL útiles

```
project = ZCAPP AND sprint in openSprints()
project = ZCAPP AND status = "Listo para pruebas"
project = ZCAPP AND labels = ruta-critica
project = ZCAPP AND labels = zona-cero
```
