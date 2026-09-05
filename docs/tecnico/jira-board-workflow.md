# Flujo del Board Jira — Zona Cero

Proyecto: [SCRUM Board](https://marcs-apps-intelligence.atlassian.net/jira/software/projects/SCRUM/boards/1)

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
**Usuario:** socio.staging@zonacero.test / ZonaCero2026!

**Checklist:**
- [ ] ...
- [ ] ...

**Evidencia:** (screenshot / video / PR)
```

## JQL útiles

```
project = SCRUM AND sprint in openSprints()
project = SCRUM AND status = "Listo para pruebas"
project = SCRUM AND labels = ruta-critica
project = SCRUM AND labels = zona-cero
```
