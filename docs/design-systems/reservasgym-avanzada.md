# Design System — ReservasGym Avanzada

Generado con **UI UX Pro Max** (`search.py --design-system`). Adaptado al proyecto existente.

---

## Regla de integración

1. **Mantener** tokens base de `app/src/index.css` y primitivos en `app/src/ui/primitives.tsx`.
2. **Override accent** con color del gym (`GymSettings.accentColor`) — no hardcodear naranja/verde del export si el gym ya tiene marca.
3. **Aplicar** patrones de layout, espaciado, UX y tipografía sugeridos abajo en pantallas nuevas: `/membresia`, `/admin/planes`, `/admin/cobros`.

---

## Pattern

- **Name:** Feature-Rich Showcase
- **En Avanzada:** tarjeta de plan como hero de Mi plan; CTA Renovar repetido (card + sticky footer móvil).
- **CTA:** primario = Renovar / Cobrar; secundario = Ver historial.

---

## Style

- **Name:** Vibrant & Block-based
- **Mode:** Dark (default app) + contraste alto
- **Keywords:** Bold, energetic, block layout, fitness
- **Evitar:** UI estática sin feedback; emojis como iconos

---

## Colores (referencia — override con marca gym)

| Role | Hex sugerido | Uso |
|---|---|---|
| Primary | `#F97316` | Accents alternativos si gym sin marca |
| Accent/CTA | `#22C55E` | Éxito pago, badge activo |
| Background | `#1F2937` | Base dark |
| Card | `#313742` | Tarjeta Mi plan |
| Destructive | `#EF4444` | Vencido, error pago |
| Muted | `#37414F` | Texto secundario |

**Estado membresía (badges):**

| Estado | Color badge |
|---|---|
| active | verde `#22C55E` |
| grace | ámbar `#F59E0B` |
| expired | rojo `#EF4444` |
| cancelled | gris muted |

---

## Tipografía

- **Heading:** Barlow Condensed (opcional; hoy app usa DM Sans — migrar gradualmente o solo títulos Mi plan)
- **Body:** Barlow / DM Sans
- **Google Fonts:**
```css
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap');
```

---

## Componentes Avanzada

| Componente | Descripción |
|---|---|
| `MembershipCard` | Plan, precio, endsAt, badge estado, barra días restantes |
| `RenewButton` | CTA full-width, loading al crear preferencia MP |
| `PaymentRow` | Fecha, monto, provider (MP / manual), status |
| `ExpiryBanner` | Sticky top, dismissible solo si >3 días |
| `MemberSearch` | Admin cobros: input + resultados |
| `ManualPaymentForm` | Plan select + método + confirmar |

---

## UX checklist (UI UX Pro Max)

- [ ] `cursor-pointer` en cards y filas clicables
- [ ] Transiciones 150–300ms en hover
- [ ] Focus visible teclado
- [ ] Contraste texto ≥4.5:1
- [ ] Iconos Lucide (no emojis)
- [ ] Responsive 375 / 768 / 1024
- [ ] `prefers-reduced-motion` respetado
- [ ] Skeleton loading en Mi plan e historial

---

## Stack React

Usar Tailwind v4 utilities existentes; composición con `Card`, `Button`, `Badge`, `PageHeader` de `@/ui/primitives`.

Comando stack adicional:
```bash
python "C:\Users\MarcoZurita\git\ui-ux-pro-max-skill\src\ui-ux-pro-max\scripts\search.py" "membership billing admin dashboard" --stack react -f markdown
```
