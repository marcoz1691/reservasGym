# ReservasGym (Zona Cero)

App de reservas, aforo, check-in QR y control de peso para gimnasios, paquete Intermedia ($4.500), para vender en Ecuador. Textos en español de Ecuador.

## Reglas permanentes

- La app está en `app/` (Vite + React 19 + TypeScript + Tailwind v4). Comandos desde `app/`.
- Lógica de negocio (aforo, lista de espera, peso) en `app/src/domain/`; datos en `app/src/data/`.
- Antes de dar algo por terminado: `npm run lint`, `npm run test` y `npm run build`.
- **Fuera de alcance Intermedia:** pagos/membresías, pasarela, facturación SRI, tienda de productos. No los agregues sin que se pida.
- Secretos solo en archivos `.env*.local`; nunca en el repo.
- Material comercial en `docs/comercial/`; plan técnico en `docs/tecnico/plan-intermedia.md`.

## Skills del proyecto

En `.claude/skills/`: `reservasgym-tiendas` (publicar en App Store/Play con Capacitor) y `reservasgym-carga` (pruebas de carga k6).
