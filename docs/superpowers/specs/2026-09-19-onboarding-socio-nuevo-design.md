# Diseño — Experiencia del socio nuevo: Inicio, Agenda y ficha técnica

**Fecha:** 2026-09-19
**Autor:** diseño colaborativo (skill `superpowers:brainstorming`)
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Un socio recién registrado, sin plan activo, recibe hoy una experiencia de error en lugar de una bienvenida:

1. **Inicio** muestra una franja roja de alarma («No tienes un plan activo. Tus reservas están pausadas.») sobre todas las pantallas, con el mismo tratamiento visual que una membresía vencida. Además ve la tarjeta «Sin reservas próximas → Explorar agenda», que lo lleva a un callejón sin salida.
2. **Agenda** aparenta funcionar: el botón «Reservar» se ve normal, pero al tocarlo siempre falla. Peor, `AgendaPage.tsx:161` envía un mensaje fijo que dice «Tu membresía está vencida» incluso a quien nunca tuvo plan.
3. **Primer ingreso**: al confirmar el correo, Supabase devuelve la sesión en la URL y `RootRedirect` lleva al socio directo a Inicio. La ficha técnica inicial nunca se le pide, aunque `FichaTecnicaModal` ya tiene implementado y probado el modo `isInitialOnboarding`, que nadie usa.

## Decisiones tomadas

| Tema | Decisión |
|------|----------|
| Estados afectados en el banner | Solo «nunca tuvo plan». Vencida, gracia y cancelada se conservan intactas (ZCAPP-18) |
| Inicio | Tarjeta de bienvenida que reemplaza el bloque «Sin reservas próximas»; el banner superior desaparece para este caso |
| Resto de pantallas | Sin avisos superiores; el gate de reserva es la red de seguridad |
| Agenda | Modo explorar: botón por sesión que invita a activar o renovar plan (también para vencidos) + franja suave solo para quien nunca tuvo plan |
| Detección de ficha pendiente | Derivada de los datos (faltan estatura o peso inicial). Sin migración de base de datos |
| Ficha en primer ingreso | Ruta propia `/bienvenida` sin navegación, con enlace «Completarla después» |

## Tema 1 — Bienvenida en Inicio

`selectMyMembership` es la única fuente de verdad y devuelve `null` exactamente cuando el socio nunca tuvo plan. Ese `null` es el disparador, consumido por dos piezas sin duplicar lógica.

**`ExpiryBanner`** pierde su rama de «sin membresía» (líneas 39-65) y devuelve `null` en ese caso. Queda dedicado a vencimiento, gracia y cancelación: baja de cuatro a tres estados.

**`WelcomeNoPlanCard`** (nuevo, `app/src/features/memberships/components/`) es presentacional y sin estado. Recibe solo `onlinePayEnabled` por props, no toca el repositorio y se exporta desde el índice de memberships. No recibe el nombre del socio porque el saludo de Inicio ya lo muestra.

**`HomePage`** calcula la membresía con el mismo selector y elige el bloque hero en tres ramas: próxima clase reservada, socio sin plan (tarjeta nueva) o plan activo sin reservas («Sin reservas próximas» actual). Métricas, chips y próximas sesiones no cambian.

`AppLayout` no cambia: sigue montando `ExpiryBanner`, que se calla solo.

### Copy y estilo

El saludo ya dice el nombre, así que la tarjeta no lo repite:

- Antetítulo (mono, mayúsculas, color marca): `PRIMER PASO`
- Título: **Activa tu plan y empieza a entrenar**
- Cuerpo: «Tu cuenta ya está lista. Elige el plan que se ajuste a tus objetivos y actívalo en recepción.» Con `VITE_ONLINE_PAYMENTS` activo, el cierre pasa a «...actívalo en línea con tarjeta o en recepción», usando la misma bandera que consulta `MiPlanPage`.
- Acción principal: botón `primary` «Ver planes» → `/membresia`. Secundaria: enlace «Explorar áreas» → `/explorar`.

Visualmente reutiliza el lenguaje del hero «Tu próxima clase»: `Card` con borde `acc/25`, resplandor `bg-acc-glow` y chip con icono `Sparkles`. Sin rojo, sin `animate-pulse` y sin botón de cerrar, porque es contenido de la pantalla y no una alarma. No lleva `role="alert"`; el título es un `h2` y los CTA heredan el `focus-ring` de los primitivos.

## Tema 2 — Agenda en modo explorar

`AgendaPage` ya importa `selectMyMembership` y `canBookMembership`, pero solo los evalúa dentro de `onBook`. Esa evaluación sube al cuerpo del componente con `useMemo`, de modo que la pantalla sepa desde el primer render si el socio puede reservar.

El bloque de acciones de cada sesión (líneas 548-555, único lugar donde se pinta el botón del socio, visible en vistas día y semana) elige entre el `Button` de reservar de siempre o un enlace a `/membresia` con icono de candado. Cubre también al socio vencido, que cae en la misma trampa; solo cambia la etiqueta:

- Sin plan nunca: **Activar plan**
- Vencido o cancelado: **Renovar plan**

El `aria-label` nombra la sesión, por ejemplo «Activar plan para reservar Hyrox 07:00».

La franja superior (`PlanRequiredNotice`, componente nuevo en memberships) aparece **solo** para quien nunca tuvo plan, con el texto «Estás explorando la agenda. Activa tu plan para reservar» y CTA «Ver planes». El socio vencido no la ve, porque ya recibe el banner de vencimiento y serían dos avisos apilados. Es un componente aparte de `WelcomeNoPlanCard`: uno es tira y el otro hero, y unificarlos con variantes reintroduce el acoplamiento que descartamos.

El gate se conserva como red de seguridad para lista de espera y áreas no incluidas en el plan, pero el mensaje fijo de la línea 161 pasa a usar la razón que devuelve el dominio, que ya distingue entre «No cuenta con una membresía activa.» y «Membresía vencida. Por favor renueva tu plan.». En paralelo, el texto por defecto de `BookingGateModal` para `no_membership` cambia a «Para reservar necesitas un plan activo. Elige tu plan en Mi Plan y actívalo en recepción.», porque hoy afirma que la membresía está vencida. Ese mismo caso deja el tratamiento rojo de error y pasa a tono marca (icono y botón), por coherencia con el resto del cambio; vencida y cancelada conservan el rojo.

Staff y admin no ven la franja ni el cambio de botón: conservan «Reservar» y «Por Socio».

## Tema 3 — Primer ingreso hacia la ficha técnica

**Detección.** Función pura nueva `isFichaPending(user)` en `app/src/domain/rules/profile.ts`: verdadera cuando el usuario es socio y le falta `heightCm` o `initialWeightKg`. Son los dos campos que el paso 1 del wizard siempre guarda vía `repo.updateProfile`, así que al terminar la ficha la condición se apaga sola. Staff y admin quedan fuera.

**Guard.** `RequireAuth` gana una decisión: con sesión válida, si la ficha está pendiente y la ruta no es `/bienvenida`, redirige ahí con `replace`, para que el botón atrás no vuelva al hash del correo de confirmación. `/login` y `/recuperar` están fuera de `RequireAuth` y no se afectan.

**Ruta.** `/bienvenida` vive dentro de `RequireAuth` pero fuera de `AppLayout`, así que no hay barra inferior ni sidebar por donde escapar. Renderiza `WelcomeFichaPage` (nueva, en `features/profile`), que monta `FichaTecnicaModal` con `isInitialOnboarding` y navega a Inicio en su `onClose`. El modal ya guarda, refresca y cierra tras el mensaje de éxito, así que el socio termina la ficha y aterriza en Inicio sin lógica adicional.

**Escape.** `FichaTecnicaModal` recibe una prop opcional `onSkip` que, en modo onboarding, pinta un enlace discreto «Completarla después» en el pie. Tiene que estar dentro del overlay, porque un enlace detrás sería inalcanzable. Al usarlo se guarda una marca en `sessionStorage` que el guard respeta: el socio entra a la app en esta sesión y la ficha se le vuelve a ofrecer en el siguiente ingreso, sin bucle de redirección.

## Casos borde

- Membresía vencida, en gracia o cancelada: banner superior sin cambios; ZC18-03, ZC18-04, ZC18-11 y ZC18-12 siguen válidos.
- Staff y admin: excluidos del banner por rol, de la franja de Agenda y del guard de ficha.
- Socio con plan activo y sin reservas: conserva «Sin reservas próximas».
- Pantalla de carga: el skeleton de Inicio no cambia.
- Vista mes de Agenda: no pinta botones hoy y sigue igual.
- Área no incluida en el plan: sin cambios, lo sigue resolviendo el gate.

## Plan de pruebas

| Archivo | Cambio |
|---------|--------|
| `ExpiryBanner.test.tsx` | El caso `renders No Membership Banner` (línea 228) se invierte: ahora afirma que **no** se renderiza banner |
| `WelcomeNoPlanCard.test.tsx` | Nuevo: copy según `onlinePayEnabled`, CTA hacia `/membresia`, ausencia de lenguaje de error |
| `HomePage.test.tsx` | Nuevo (hoy no existe): las tres ramas del hero |
| `multizoneAgenda.test.tsx` | Revisar aserciones sobre «Reservar»; agregar socio sin plan ve «Activar plan» y no «Reservar», socio activo sigue viendo «Reservar», staff no ve la franja |
| `domain/rules/profile.test.ts` | Nuevo: `isFichaPending` con socio sin datos, socio con datos y staff |
| Guard / router | Ficha pendiente aterriza en `/bienvenida`; ficha completa entra a Inicio; saltar permite entrar sin rebote; completar la ficha lleva a Inicio |
| Regresión | Suite completa de ZCAPP-18 en verde |

## Impacto en documentación

El checklist `docs/tecnico/qa-checklists/ZCAPP-18-mi-plan-historial.md` registra ZC18-O1 como corregido citando el texto «No tienes un plan activo…», que deja de existir en el banner. Esa fila se actualiza para que el historial de QA no quede contradictorio.

## Fuera de alcance

- Rediseño de los estados de vencimiento, gracia y cancelación.
- Avisos superiores en Reservas, Peso o Explorar.
- Columna nueva en base de datos para marcar la ficha completada.
- Cambios en el flujo de pago en línea (Datafast) o en el correo de confirmación de Supabase.
