# Checklist entrega — Avanzada ($6.500)

Lista de verificación antes de entregar al cliente (p. ej. William Ramírez).

---

## Documentación

- [ ] [plan-avanzada.md](./plan-avanzada.md) revisado
- [ ] [prototipo/avanzada](../prototipo/avanzada/) wireframes compartidos
- [ ] [mercadopago-setup.md](./mercadopago-setup.md) entregado al gym
- [ ] Presentación comercial actualizada con pantallas Avanzada

---

## Funcional — Socio

- [ ] `/membresia` muestra plan, fecha fin, días restantes
- [ ] Historial de pagos visible
- [ ] Renovar abre Mercado Pago (sandbox/prod)
- [ ] Tras pago aprobado, membresía extendida
- [ ] Banner si vence en ≤7 días
- [ ] Socio expired no puede reservar; modal con link a Mi plan
- [ ] Reservas previas al vencimiento siguen válidas

---

## Funcional — Admin / Staff

- [ ] `/admin/planes` CRUD completo
- [ ] `/admin/cobros` busca socio por nombre/email
- [ ] Cobro manual: efectivo, transferencia, tarjeta POS
- [ ] Tab/lista vencidos (grace + expired)
- [ ] Dashboard admin enlaza a Planes y Cobros

---

## Técnico

- [ ] Tests Vitest dominio membresías/pagos verdes
- [ ] `schema.sql` + RLS aplicado en Supabase
- [ ] Edge Functions desplegadas
- [ ] Secrets MP configurados (prod)
- [ ] Demo LocalRepository sin MP funciona
- [ ] App iOS/Android build smoke (Capacitor)

---

## Cliente — inputs

- [ ] Logo y colores cargados (marca)
- [ ] Planes y precios definidos (mensual, trimestral…)
- [ ] Qué pasarela ya usan: **Datafast físico** (confirmado) — online no en v1
- [ ] Credenciales Dataweb (solo si activan fase online después)
- [ ] Cuentas Apple Developer / Google Play (si app en tiendas)
- [ ] Staff capacitado en panel de cobros (1 sesión)

---

## Comercial

- [ ] Alcance Avanzada vs Completa explicado por escrito
- [ ] Mantenimiento opcional ~$89/mes ofrecido
- [ ] Comisiones de la pasarela aclaradas (asume el gym)

---

## Post-entrega (90 días garantía)

- [ ] Contacto soporte definido
- [ ] Backup Supabase verificado
- [ ] Monitoreo webhook MP (logs Edge)
