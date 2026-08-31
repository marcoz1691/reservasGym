# PLAN DE GESTIÓN DE PROYECTO, CRONOGRAMA MAESTRO Y LÍNEA DE TIEMPO
## PROYECTO: APLICACIÓN MÓVIL ZONA CERO PERFORMANCE CENTER (PAQUETE AVANZADO)

**Documento:** Project Management Master Schedule & Baseline (Línea Base del Proyecto)  
**Metodología:** Agile-Hybrid (Scrum-ban con Gates de Control de Calidad y CPM)  
**Project Manager / Lead Architect:** Marco Vinicio Zurita Rojas  
**Sponsor / Product Owner:** William Ricardo Ramírez Salguero (Zona Cero)  
**Presupuesto Contractual:** $6.800,00 USD (IVA 15% incluido) — pagos 30/50/20: $2.040 / $3.400 / $1.360  
**Fecha de Firma del Contrato:** 28 de Agosto de 2026 (Quito, parroquia Calderón)  
**Fecha de Línea Base (Start Baseline):** 01 de Septiembre de 2026  
**Fecha de Entrega Técnica (Fast-Track Target):** 20 de Noviembre de 2026 (Semana 12)  
**Fecha Límite Contractual (Go-Live Deadline):** 31 de Diciembre de 2026 (Semana 17)  
**Zona Horaria de Operación:** Ecuador (`America/Guayaquil` / UTC-5)  

---

## 1. PROJECT CHARTER & RESUMEN EJECUTIVO

### 1.1 Objetivos del Proyecto
Entregar y poner en producción la solución digital integral para **Zona Cero Performance Center**, compuesta por una aplicación móvil nativa (iOS y Android) para socios, y un panel web/móvil para recepción y administración, cubriendo reservas de 8 disciplinas deportivas, cobros en recepción con datáfono (Datafast POS), control de membresías con vigencias automáticas y módulo antropométrico de peso e IMC.

### 1.2 Estrategia de Planificación Senior (Fast-Track + Buffer de Contingencia)
- **Plazo Total Contractual:** 17 Semanas (122 días calendario).
- **Esfuerzo de Construcción Técnica (Ruta Crítica):** 12 Semanas (Sprints 1 al 6).
- **Buffer Estratégico de Contingencia:** 5 Semanas (35 días) dedicadas exclusivamente a la resolución de revisiones de Apple/Google Store, setup de cuentas de desarrollador y marcha blanca operativa.

```
+---------------------------------------------------------------------------------------------------+
| DURACIÓN TOTAL DEL CONTRATO: 17 SEMANAS (01 Sep 2026 - 31 Dic 2026)                               |
+-------------------------------------------------------------+-------------------------------------+
| FASES TÉCNICAS (SPRINTS 1 AL 6): 12 SEMANAS                 | BUFFER ESTRATÉGICO: 5 SEMANAS       |
| 01 Sep 2026 ------------------------------> 20 Nov 2026     | 21 Nov 2026 --------> 31 Dic 2026   |
| [Desarrollo, Pruebas TDD, UI/UX, Staging, QA & Capacitor]   | [Certificación Tiendas + Go-Live]   |
+-------------------------------------------------------------+-------------------------------------+
```

---

## 2. ESTRUCTURA DE DESGLOSE DEL TRABAJO (WBS / EDT)

```
1.0 PROYECTO APP ZONA CERO AVANZADO
 ├── 1.1 GESTIÓN Y ARQUITECTURA BASE
 │    ├── 1.1.1 Kickoff, Acta de Inicio y Requerimientos
 │    ├── 1.1.2 Provisionamiento Supabase (PostgreSQL, RLS Staging & Prod)
 │    └── 1.1.3 Módulo de Autenticación Segura (JWT, Registro, Login y Recuperación)
 ├── 1.2 MOTOR DE MEMBRESÍAS Y COBROS (CORE FINANCIERO)
 │    ├── 1.2.1 Catálogo de Planes y Duraciones (Reglas de Dominio TDD)
 │    ├── 1.2.2 Panel de Cobros Recepción (Efectivo, Transferencia, Datafast POS)
 │    ├── 1.2.3 Pantalla Socio "Mi Plan" e Historial de Pagos
 │    └── 1.2.4 Gate de Seguridad de Reservas (Validación de Vencimiento y Gracia 3 días)
 ├── 1.3 MOTOR DE RESERVAS MULTIZONA Y CONTROL DE ASISTENCIA
 │    ├── 1.3.1 Parametrización 8 Áreas en Timezone Ecuador (America/Guayaquil)
 │    ├── 1.3.2 Motor de Agendamiento, Aforos, Solapamientos y Lista de Espera
 │    └── 1.3.3 Módulo de Check-in con Validación QR Dinámico
 ├── 1.4 MÓDULO DE SEGUIMIENTO ANTROPOMÉTRICO (PESO E IMC)
 │    ├── 1.4.1 Registro de Medidas Corporales, Estatura y Peso
 │    └── 1.4.2 Cálculo Automatizado de IMC y Gráfica Histórica de Progreso
 ├── 1.5 EXPERIENCIA DE USUARIO (UI/UX PRO MAX) Y BRANDING
 │    ├── 1.5.1 Design System Deportivo Dark Mode & Tokens Zona Cero
 │    └── 1.5.2 Adaptación Responsive (Mobile Socio, Tablet/Desktop Recepción)
 ├── 1.6 ASEGURAMIENTO DE CALIDAD (QA) Y CAPACITACIÓN
 │    ├── 1.6.1 Pruebas End-to-End (E2E) en Ambiente Staging
 │    └── 1.6.2 Capacitación Operativa al Personal de Recepción y Administración
 ├── 1.7 DESPLIEGUE NATIVO Y PUBLICACIÓN EN TIENDAS (APP STORE & GOOGLE PLAY)
 │    ├── 1.7.1 Gestión de Cuentas Apple Developer ($99) y Google Play Console ($25)
 │    ├── 1.7.2 Compilación de Binarios Capacitor (iOS .ipa / Android .aab)
 │    ├── 1.7.3 Preparación de Fichas de Tienda, Assets y Políticas de Privacidad
 │    └── 1.7.4 Envío y Acompañamiento en la Revisión Oficial
 └── 1.8 PUESTA EN PRODUCCIÓN, MARCHA BLANCA Y CIERRE
      ├── 1.8.1 Despliegue en Producción y Carga de Catálogo Oficial
      ├── 1.8.2 Marcha Blanca con Usuarios Reales en Zona Cero
      └── 1.8.3 Firma de Acta de Entrega y Activación de Garantía Técnica (30 días + SLA hotfix)
```

---

## 3. CRONOGRAMA MAESTRO POR SPRINTS (LÍNEA DE TIEMPO)

| Sprint / Hito | Fechas | Días | Dependencia | Entregables Clave (DoD - Definition of Done) |
|---|---|:---:|:---:|---|
| **Sprint 1: Base de Datos & Auth** | 01 Sep - 13 Sep | 13 | Inicio | BD Supabase desplegada, tablas relacionales con RLS, login JWT y recuperación de clave funcional. |
| **Sprint 2: Membresías & Planes** | 14 Sep - 24 Sep | 11 | Sprint 1 | Catálogo de planes, estados `active`/`grace`/`expired`, pruebas unitarias TDD aprobadas. |
| **Sprint 3: Cobros POS & Gate** | 25 Sep - 04 Oct | 10 | Sprint 2 | Panel de cobros en recepción (Datafast físico/efectivo), vista socio "Mi Plan" y bloqueo a vencidos. |
| **Sprint 4: Agenda 8 Áreas & QR** | 05 Oct - 15 Oct | 11 | Sprint 3 | Motor de reservas en horario Ecuador (UTC-5), control de aforos, waitlist y generación de Check-in QR. |
| **Sprint 5: Antropometría & UI/UX** | 16 Oct - 28 Oct | 13 | Sprint 4 | Módulo de peso/IMC, design system premium oscuro y branding corporativo de Zona Cero aplicado. |
| **Sprint 6: Staging QA & Capacitación** | 29 Oct - 15 Nov | 18 | Sprint 5 | App desplegada en Staging, pruebas E2E en dispositivos reales y personal de recepción capacitado. |
| **★ HITO FAST-TRACK: ENVÍO A TIENDAS** | **20 Nov 2026** | **Milestone** | **Sprint 6** | **Binarios Capacitor subidos a App Store Connect y Google Play Console.** |
| **Buffer: Certificación en Tiendas** | 21 Nov - 04 Dic | 14 | Hito Fast-Track | Monitoreo y resolución de observaciones de Apple y Google hasta aprobación final. |
| **Sprint 7: Go-Live & Marcha Blanca** | 05 Dic - 20 Dic | 16 | Buffer | App publicada para descarga, migración a Supabase Prod y operación real en gimnasio. |
| **★ HITO FINAL: CIERRE CONTRACTUAL** | **31 Dic 2026** | **Milestone** | **Sprint 7** | **Acta de entrega firmada, cierre de proyecto y activación de garantía de 30 días (SLA hotfix: 48 h bloqueante / 5 días hábiles no bloqueante).** |

---

## 4. ANÁLISIS DE RUTA CRÍTICA (CPM - CRITICAL PATH METHOD)

La **Ruta Crítica** identifica la secuencia de actividades que determinan la duración mínima del proyecto:

$$\text{Ruta Crítica: } \text{WBS 1.1.2} \rightarrow \text{1.1.3} \rightarrow \text{1.2.1} \rightarrow \text{1.2.2} \rightarrow \text{1.2.4} \rightarrow \text{1.3.1} \rightarrow \text{1.3.2} \rightarrow \text{1.5.1} \rightarrow \text{1.6.1} \rightarrow \text{1.7.2} \rightarrow \text{1.7.4} \rightarrow \text{1.8.1}$$

- **Holgura Total en Desarrollo Técnico:** 0 días (requiere disciplina estricta de ejecución semana a semana).
- **Holgura Estratégica del Proyecto (Project Float):** **35 días de colchón** entre el envío técnico (20 de Noviembre) y el cierre contractual (31 de Diciembre), asegurando que cualquier demora externa de Apple/Google o bancaria no comprometa la fecha contractual.

---

## 5. MATRIZ DE GESTIÓN DE RIESGOS (RISK REGISTER)

| ID | Riesgo Identificado | Prob. | Imp. | Severidad | Plan de Mitigación / Contingencia | Responsable |
|:---:|---|:---:|:---:|:---:|---|:---:|
| **R1** | Demora del cliente en crear cuentas Apple ($99) o Google ($25) | Media | Alto | **Alta** | Iniciar trámite en Semana 2 con guía paso a paso y sesión remota de acompañamiento. | PM / Cliente |
| **R2** | Rechazo inicial de la app en revisión de Apple por permisos o guías | Media | Medio | **Media** | Fast-Track al 20 de Noviembre provee 3 semanas para responder apelaciones sin afectar el Go-Live. | Lead Dev |
| **R3** | Inconsistencia en cobros por falta de conectividad en recepción | Baja | Medio | **Baja** | Repositorio offline-first con sincronización automática en cuanto recupera conexión. | Lead Dev |
| **R4** | Resistencia al cambio del personal de recepción con el nuevo panel | Media | Medio | **Media** | Capacitación práctica anticipada en Semana 11 y manual operativo simplificado. | PM / Cliente |
| **R5** | Desfase horario en reservas de socios | Baja | Alto | **Baja** | Fijación estricta de zona horaria `America/Guayaquil` (UTC-5) en base de datos y clientes. | Lead Dev |

---

## 6. MATRIZ RACI (RESPONSABILIDADES Y GOBERNANZA)

*Convención:* **R** = Responsible (Ejecuta), **A** = Accountable (Aprueba/Responde), **C** = Consulted (Consultado), **I** = Informed (Informado)

| Entregable / Actividad WBS | Lead Dev / PM (Marco Zurita) | Product Owner (Zona Cero) | Personal Recepción | Tiendas (Apple/Google) |
|---|:---:|:---:|:---:|:---:|
| **Arquitectura, BD & Auth** | **R / A** | **I** | **I** | - |
| **Definición de Planes y Horarios** | **C** | **R / A** | **C** | - |
| **Motor de Membresías & Cobros** | **R / A** | **C** | **I** | - |
| **Reservas, QR y Antropometría** | **R / A** | **I** | **I** | - |
| **Aporte de Logotipo y Marca** | **C** | **R / A** | - | - |
| **Pruebas de Aceptación (Staging)** | **R** | **A** | **C** | - |
| **Capacitación Operativa** | **R / A** | **I** | **R** | - |
| **Pago y Alta de Cuentas Dev** | **C** | **R / A** | - | **A** |
| **Compilación y Subida de Binarios** | **R / A** | **I** | - | **C** |
| **Revisión y Certificación de App** | **R** | **I** | - | **R / A** |
| **Puesta en Producción y Marcha Blanca** | **R / A** | **A** | **R** | - |

---

## 7. PLAN DE COMUNICACIÓN Y PUERTAS DE CONTROL (QUALITY GATES)

1. **Checkpoints Semanales:** Reporte de avance y estado de tareas (vía WhatsApp / Correo).
2. **Sprint Demos (Bisemanales):** Demostración interactiva en videollamada con el cliente al finalizar cada hito funcional.
3. **Quality Gate 1 (04 Octubre):** Aprobación del módulo de cobranzas y membresías.
4. **Quality Gate 2 (15 Noviembre):** Aprobación formal de la App en Staging previa a la compilación de producción.
5. **Quality Gate 3 (20 Noviembre):** Firma de autorización de subida a tiendas de aplicaciones.
6. **Quality Gate 4 (31 Diciembre):** Firma de Acta de Entrega y Cierre Definitivo del Proyecto.

---

## 8. CONCLUSIÓN DEL PROJECT MANAGER

El presente plan establece una **gestión de ingeniería predecible, trazable y blindada contra riesgos**. Al desacoplar el desarrollo técnico (finalizado el **20 de Noviembre**) del hito contractual final (**31 de Diciembre**), garantizamos la entrega de un producto premium, de alto desempeño y completamente operativo para el inicio de temporada de **Zona Cero Performance Center**.
