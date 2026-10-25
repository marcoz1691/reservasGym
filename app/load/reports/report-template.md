# Informe de stress en QA — <run>

> Copia este archivo a `load/reports/<run>/informe.md` y complétalo con datos reales de la corrida.
> Criterios y definiciones: [`../slo.md`](../slo.md). Hot paths: [`../inventory.md`](../inventory.md).

## 1. Datos de la corrida
| Campo | Valor |
|---|---|
| Fecha / responsable | |
| Rama y commit | |
| Run | `<run>` |
| Escenarios | A (reservas) · B (lectura agenda) |
| Comando exacto | |
| Variables no secretas | `LOAD_USER_COUNT`, `LOAD_SESSION_COUNT`, `LOGIN_FRACTION`, `LOAD_MIX`, `REFRESH_PROB`, `SMOKE` |
| Versión de k6 | |
| Duración | |
| Exit code k6 (A / B) · exit code `load:check` | |

## 2. Ambiente
| Campo | Valor |
|---|---|
| Proyecto | QA `kqhmclbexnnsbzbgerbx` (confirmar que **no** es prod) |
| Plan / compute | Free · |
| Filas iniciales `bookings` / `sessions` | |
| Usuarios de carga (`user_count`) | |
| Membresías (activas / gracia / vencidas) | |
| % de VUs con token válido | |

## 3. Latencias
| Id | Métrica k6 | Escenario | Muestras | p50 | p95 | p99 | Umbral p95 | Resultado |
|---|---|---|---|---|---|---|---|---|
| L1 | `login_duration` | A | | | | | < 1500 ms | |
| L2 | `list_sessions_duration` | A / B | | | | | < 1000 ms | |
| L3 | `book_session_duration` | A | | | | | < 1500 ms | |
| — | `fetch_state_duration` (informativo) | B | | | | | — | |

DEUDA = hasta 1,5× el umbral (2250 / 1500 / 2250 ms). FALLA = más.

## 4. Errores y límites
| Concepto | Valor | Umbral |
|---|---|---|
| Peticiones totales | | |
| E1: 5xx + timeouts (% de peticiones) | | < 1 % |
| `rate_limited` (429) | | ≤ 5 % |
| `auth_expired` (401 por JWT caducado) | | informativo |
| `booking_ok` | | ≤ capacidad |
| `booking_full` / `waitlisted` | | |
| `booking_denied_membership` | | |
| 400 fuera de la lista de negocio | | 0 |

## 5. Techo del plan Free (código vs. infraestructura)
- VUs a los que empieza a degradar:
- CPU / memoria / conexiones (panel de Supabase):
- Egress de la corrida y acumulado frente a 5 GB:
- Logins por minuto antes del primer 429:
- Diagnóstico con evidencia:

## 6. Integridad (`npm run load:check -- --run <run>`)
| Control | Descripción | Violaciones |
|---|---|---|
| I1 | Reservas activas ≤ capacidad | |
| I2 | `booked_count` = conteo en los estados que cuenta el trigger | |
| I3 | Sin duplicados activos (sesión, usuario) | |
| I4 | Sin `booked_count` negativo | |
| I5 | Ningún socio vencido con reserva activa | |
| I6 | Posiciones de lista de espera únicas y contiguas | |
| I7 | `booking_ok` ≤ capacidad de la sesión popular | |

Salida de `load:check` (sin claves):

## 7. EXPLAIN (`../explain.sql`)
| Consulta | Plan | Tiempo | Filas | Observación |
|---|---|---|---|---|
| `sessions` por `starts_at` | | | | |
| `bookings` por `session_id` | | | | |
| `bookings` por `user_id` | | | | |

## 8. Remediaciones priorizadas
| Prioridad | Hallazgo | Causa probable | Remediación | Esfuerzo | SLO que mejora |
|---|---|---|---|---|---|
| P0 | | | | | |
| P1 | | | | | |
| P2 | | | | | |

Candidatas a verificar: índices en `bookings(session_id)`, `bookings(user_id)` y `sessions(starts_at)`; acotar `fetchState`; envolver `auth.uid()` / `is_staff()` en `(select …)` en las políticas RLS.

## 9. Validez de la corrida (slo.md §3)
- [ ] `load:check` corrido después de la misma corrida
- [ ] ≥ 90 % de VUs con token válido
- [ ] 429 ≤ 5 %
- [ ] Seed completo (≥ 1000 usuarios, las 3 clases de membresía)
- [ ] Commit, comando, compute y filas iniciales registrados

Si falta alguna casilla, el veredicto es **NO CONCLUYENTE** y la corrida se repite.

## 10. Veredicto del gate
| Escenario | Veredicto | Regla aplicada (cita textual de slo.md) | Valores |
|---|---|---|---|
| A | | | |
| B | | | |
| **Final (el peor)** | | | |

El go-live en producción (`gvgqlmoulgcickxognto`) sigue bloqueado hasta contar con plan Pro y backups, aunque QA Free pase.

## 11. Limpieza
- [ ] `npm run load:cleanup` (dry-run) revisado
- [ ] `npm run load:cleanup -- --yes` ejecutado
- [ ] No quedan `load.*@zonacero.test` ni sesiones `load-*`
