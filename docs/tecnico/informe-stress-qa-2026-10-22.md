# Informe de stress en QA — 2026-10-22

Harness: `app/load/` (README allí). Plan: `.cursor/plans/stress_test_qa_5dba5316.plan.md`. Criterios: `app/load/slo.md`. Hot paths: `app/load/inventory.md`.

## Veredicto: NO LANZAR con la arquitectura de lectura actual sobre el plan Free

| Escenario | Veredicto | Regla aplicada (slo.md) | Valores |
|---|---|---|---|
| A: carrera de reservas (200 VUs, 12 min) | **NO LANZAR** | algún p95 > 1,5× su umbral | login p95 5966 ms (umbral 1500), listSessions p95 2894 ms (1000), `book_session` p95 2871 ms (1500). Errores 0 %. |
| B: burst de agenda (pico 300 VUs, 4 min) | **NO LANZAR** | error rate ≥ 1 % | 47,9 % de peticiones fallidas (timeouts a 30 s); `fetchState` p50 20 s. |
| **Final (el peor)** | **NO LANZAR** | | |

**Integridad: perfecta.** Bajo la carga de A no hubo sobreventa ni datos corruptos: `load-popular` (capacidad 30) quedó con exactamente 30 reservas y 350 en lista de espera; I1–I8 sin violaciones (3.505 reservas, 1.875 esperas). El problema no es de correctitud sino de capacidad y latencia.

El go-live sigue bloqueado hasta plan Pro y backups en producción (`gvgqlmoulgcickxognto`), aunque aquí hubiera pasado.

## 1. Datos de la corrida
| Campo | Valor |
|---|---|
| Fecha | 22-oct-2026 (A 22:38–22:50, B ≈22:55–22:59, hora de Guayaquil) |
| Rama / commit base | `test/stress-qa-harness` sobre `main` @ `3ad39af` |
| Comandos | `npm run load:seed` · `npm run load:mint -- --states grace,expired --limit 120` · `npm run load:a -- 2026-10-22-full-a` · `B_SCALE=0.6 npm run load:b -- 2026-10-22-full-b` · `npm run load:check -- --run 2026-10-22-full-a` · `npm run load:cleanup -- --yes` |
| k6 | v2.3.0, ejecutado desde un solo Mac |
| Humos previos | `smoke2-a` y `smoke2-b` (10 VUs, 1 min): 0 % de errores, p95 de `book_session` 278 ms |

## 2. Ambiente
- QA `kqhmclbexnnsbzbgerbx`, plan Free. Se sembraron 1.000 socios sintéticos (700 vigentes, 150 en gracia, 150 vencidos), 1 staff y 41 sesiones (`load-popular` con cupo 30). Antes: 22 usuarios reales, 0 sesiones futuras. Después de la limpieza: los mismos 22 usuarios y 0 restos de carga.
- Pool de tokens: 445 (el login de Auth en Free se limitó a ~0,3 logins/s con respuestas 429; generar 1.000 tomaba más de 50 min y los tokens duran 1 h). El 100 % de los VUs arrancó con token válido; 6.866 iteraciones de A reutilizaron tokens del pool para usuarios sin token propio.
- B se corrió con `B_SCALE=0.6` (pico 300 VUs en lugar de 500) para acotar el egress; ya con 300 colapsó, así que 500 no aportaba.

## 3. Latencias (ms)
| Métrica | Esc. | n | p50 | p95 | p99 | Umbral p95 | Resultado |
|---|---|---|---|---|---|---|---|
| `login_duration` (L1) | A | 20 | 725 | 5.966 | 7.197 | < 1.500 | FALLA (> 1,5×) |
| `list_sessions_duration` (L2) | A | 14.793 | 308 | 2.894 | 5.716 | < 1.000 | FALLA (> 1,5×) |
| `book_session_duration` (L3) | A | 14.793 | 320 | 2.871 | 5.729 | < 1.500 | FALLA (> 1,5×) |
| `fetch_state_duration` (14 lecturas, informativo) | A | 2.966 | 1.755 | 6.780 | 10.422 | — | — |
| `fetch_state_duration` | B | 170 | 20.233 | 28.783 | 29.666 | — | colapso |
| `list_sessions_duration` | B | 292 | 6.092 | 24.029 | 27.554 | < 1.000 | FALLA |

En A todas las lecturas y escrituras quedan en la misma banda (p50 ≈ 300 ms, p95 ≈ 2,9 s), incluidas las más simples: la lentitud no es de una consulta concreta.

## 4. Errores y límites
| Concepto | A | B |
|---|---|---|
| Peticiones totales | 91.869 (127 req/s) | 10.944 (45 req/s) |
| Error rate (5xx / timeout) | **0 %** | **47,9 %** |
| 429 / 401 | 0 / 0 | 0 / 0 |
| Resultados de `book_session` | ok 1.630 · lista de espera 1.875 · vencidos denegados 2.301 · duplicados 8.987 · otras denegaciones 0 | — |
| Datos recibidos | 205 MB | 21 MB |

Egress total de la prueba ≈ 226 MB (≈ 4,5 % de los 5 GB mensuales del plan Free).

## 5. Techo del plan Free: código vs. infraestructura
- **Qué sabemos.** A 10 VUs todo va bien (`book_session` p95 278 ms). A 200 VUs ya se superan los SLO de latencia sin errores. A 300 VUs de B la instancia se satura: la mitad de las peticiones expira.
- **Efecto multiplicador de `fetchState`.** Cada refresco del socio lanza 14 `select('*')` en paralelo (≈ 49 KB) más 2 lecturas de perfil; cada acción (login, reservar) lo dispara. Con 300 VUs son ≈ 4.200 lecturas simultáneas por oleada: es el mismo patrón que haría la app real, y es lo primero que hay que acotar.
- **Las consultas no son lentas.** EXPLAIN (ANALYZE): conteo de ocupantes de una sesión 22 ms con seq scan sobre 3.530 reservas; `bookings` por usuario 1,4 ms; `sessions` por rango 0,17 ms. Faltan índices (ver 8), pero con estos volúmenes no explican segundos.
- **Hipótesis más probable (sin verificar):** saturación de CPU y/o del pool de conexiones de la instancia Free por el volumen de peticiones concurrentes. No se revisaron las métricas del panel de Supabase (CPU, conexiones) de esa ventana horaria: hacerlo es el primer paso para confirmar.
- **Efecto observado tras B:** QA quedó inalcanzable (REST con timeouts, Auth 504) unos minutos y se recuperó sola. Los datos no sufrieron: B es de solo lectura.
- **Límite de la medición:** k6 corrió desde un solo Mac; no se midió su CPU. A 127 req/s es poco probable que sea el cuello, pero B a 300 VUs podría haber aportado latencia del cliente.

## 6. Integridad (`load:check --run 2026-10-22-full-a`)
Fixture OK (41 sesiones, 1.000 socios con las tres cohortes). I1 ocupantes ≤ capacidad · I2 `booked_count` = ocupantes · I3 sin duplicados · I4 sin negativos · I5 ningún socio sin membresía vigente con reserva activa · I6 lista de espera consistente · I7 `1 ≤ booking_ok ≤ capacidad total` · I8 sin estados desconocidos: **todos OK, 0 violaciones**. `load-popular`: capacidad 30, `booked_count` 30, ocupantes 30, esperas 350.

## 7. EXPLAIN
| Consulta | Plan | Tiempo | Observación |
|---|---|---|---|
| `bookings` por `session_id` + estados | Seq Scan, 3.500 filas descartadas | 22,3 ms | Sin índice; crece lineal con las reservas y corre dentro del bloqueo de `book_session`. |
| `bookings` por `user_id` | Seq Scan | 1,4 ms | Sin índice; el borrado en cascada de usuarios también lo usa. |
| `sessions` por `starts_at` | Seq Scan, 141 filas | 0,17 ms | Irrelevante hoy; la tabla es pequeña. |

## 8. Remediaciones priorizadas
| Prio | Hallazgo | Causa probable | Remediación | Esfuerzo | SLO que mejora |
|---|---|---|---|---|---|
| P0 | `fetchState` = 14 lecturas completas por refresco; cada acción lo repite (~17 peticiones) | Diseño de lectura del cliente | RPC única `get_member_state()` con solo lo que el socio necesita; selects acotados; no refrescar todo tras cada acción | Medio | L2, L3, error rate |
| P0 | La instancia Free se satura a 200–300 VUs | Cómputo/conexiones del plan | Plan Pro (ya bloquea el go-live) y repetir esta prueba allí | Bajo | L1–L3, error rate |
| P1 | Faltan índices en `bookings(session_id)`, `bookings(user_id)`, `sessions(starts_at)`, `waitlist_entries(session_id, position)` y `(user_id)`, `check_ins(user_id)` | No existen | Crear índices y repetir EXPLAIN antes/después | Bajo | L3 (dentro del bloqueo) |
| P1 | RLS usa `auth.uid()`/`is_staff()` sin envolver en `(select …)` | Reevaluación por fila (hipótesis) | Envolver y medir | Bajo | L2 |
| P2 | Auth Free limita a ~0,3 logins/s por IP | Límite del plan | Para pruebas: subir temporalmente el rate limit en el panel o fabricar JWT con la clave del proyecto; en producción no aplica a usuarios distintos | Bajo | validez de pruebas |
| P2 | No se encontró el punto de quiebre exacto | Solo se probó 10, 200 y 300 | Escalera de B: 25 → 50 → 100 → 150 → 200 VUs con pausa entre pasos | Bajo | dimensionamiento |

## 9. Validez de la corrida
- [x] `load:check` corrido después de A
- [x] ≥ 90 % de VUs con token válido (100 %)
- [x] 429 ≤ 5 % (0 %)
- [x] Seed completo (1.000 usuarios, tres cohortes)
- [x] Commit, comandos y ambiente registrados
- [ ] Métricas del panel de Supabase de esa ventana (pendiente)
- [ ] B no pasó `load:check` (es de solo lectura: no aplica)
Limitaciones: pool de 445 tokens para 1.000 usuarios, B a 300 VUs, cliente único.

## 10. Limpieza
Dry-run revisado y `--yes` ejecutado: 1.001 usuarios, 41 sesiones, 3.505 reservas y 1.875 esperas borrados; verificación en 0; los 22 usuarios reales intactos; `load/.tmp` eliminado.

## Qué sigue
1. Revisar CPU y conexiones del panel de Supabase de 22-oct 22:38–23:00 para confirmar la hipótesis.
2. Atacar P0 (`fetchState` → RPC) y P1 (índices) en un PR aparte con EXPLAIN antes/después, y repetir A y B.
3. Repetir en un proyecto con el plan que se vaya a usar en producción (Pro).
