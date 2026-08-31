# Prototipo — Avanzada ($6.500)

Índice de wireframes y flujos para validación con el cliente **antes** de conectar Mercado Pago en producción.

---

## Documentos

| Archivo | Contenido |
|---|---|
| [diagramas-app-mobile.md](./diagramas-app-mobile.md) | **Diagramas Mermaid** (mapa, día típico, renovar, gate) |
| [flujo-app-mobile.md](./flujo-app-mobile.md) | Recorrido completo app móvil del socio |
| [flujos-funcionales.md](./flujos-funcionales.md) | Flujos A–F en lenguaje cliente |
| [wireframes-socio.md](./wireframes-socio.md) | Mi plan, banner, gate reservas, éxito pago |
| [wireframes-admin.md](./wireframes-admin.md) | Planes CRUD, panel cobros, vencidos |

## Referencias técnicas

- Spec: [../../tecnico/plan-avanzada.md](../../tecnico/plan-avanzada.md)
- **Anexo contrato (checklist):** [../../comercial/anexo-contrato-avanzada.md](../../comercial/anexo-contrato-avanzada.md)
- Design system: [../../design-systems/reservasgym-avanzada.md](../../design-systems/reservasgym-avanzada.md)
- GYM-One (referencia UX): `GYM-One/dashboard/`, `GYM-One/admin/boss/sell/`

---

## Criterios de aceptación del prototipo

1. Cliente entiende cómo renueva el socio desde el celular.
2. Cliente entiende cómo cobra recepción en efectivo.
3. Cliente ve qué pasa cuando la membresía vence (gracia 3 días, luego bloqueo reservas).
4. Wireframes alineados con marca del gym (logo + color accent).

---

## Fases del prototipo

| Fase | Entregable | Estado |
|---|---|---|
| P1 | Wireframes markdown (este folder) | Listo |
| P2 | Design system export | Listo |
| P3 | Prototipo navegable React (LocalRepository) | Pendiente implementación |
| P4 | Sandbox Mercado Pago | Pendiente Edge Functions |

---

## Cómo revisar con el cliente

1. Enviar PDF o link a wireframes + flujos.
2. Llamada 30 min: recorrer flujo A (socio paga) y B (recepción cobra).
3. Confirmar planes y precios reales del gym.
4. Aprobar antes de fase MP producción.
