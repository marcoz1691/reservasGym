/**
 * Claves de TanStack Query. Por ahora el repositorio entrega todo el estado del
 * gimnasio en una sola llamada (`repo.load()`), así que hay una sola consulta;
 * las claves por recurso llegarán cuando el repositorio permita cargar por partes.
 */
export const queryKeys = {
  all: ['gym'] as const,
  /** Usuario de la sesión + estado del gimnasio (agenda, reservas, planes, pagos…). */
  gymState: () => [...queryKeys.all, 'state'] as const,
}
