# Diagramas — App móvil socio

Flujos visuales para presentar al cliente.  
Abrí este archivo en Cursor / GitHub / VS Code con preview Mermaid.

Documento narrativo: [flujo-app-mobile.md](./flujo-app-mobile.md)

---

## Diagrama 1 — Mapa general de la app

```mermaid
flowchart TB
  subgraph auth [Entrada]
    Login[Login email]
  end

  subgraph tabs [Tabs inferiores]
    Inicio[Inicio]
    Explorar[Explorar]
    Reservas[Mis reservas]
    MiPlan[Mi plan]
    Peso[Peso]
  end

  subgraph booking [Reservar clase]
    Detalle[Detalle sesion]
    Gate{Membresia vigente?}
    Confirmar[Reserva confirmada]
    Modal[Modal: Renueva tu plan]
  end

  subgraph checkin [Dia de clase]
    QR[Mostrar QR]
  end

  subgraph pay [Pagos Avanzada]
    Renovar[Renovar ahora]
    MP[Checkout Mercado Pago]
    Exito[Membresia extendida]
  end

  Login --> Inicio
  Inicio --> Explorar
  Inicio --> Reservas
  Inicio --> MiPlan
  Inicio --> Peso

  Explorar --> Detalle
  Detalle --> Gate
  Gate -->|Si active o grace| Confirmar
  Gate -->|No expired| Modal
  Modal --> MiPlan
  Confirmar --> Reservas
  Reservas --> QR

  MiPlan --> Renovar
  Renovar --> MP
  MP -->|Aprobado| Exito
  Exito --> MiPlan
  MP -->|Rechazado| MiPlan
```

---

## Diagrama 2 — Día típico (camino feliz)

```mermaid
flowchart LR
  A[1 Abrir app] --> B[2 Inicio]
  B --> C[3 Explorar]
  C --> D[4 Elegir clase]
  D --> E[5 Reservar]
  E --> F[6 Mis reservas]
  F --> G[7 Dia de clase: QR]
  G --> H[8 Check-in en gym]
  H --> I[9 Opcional: registrar peso]
```

---

## Diagrama 3 — Renovar membresía (Mercado Pago)

```mermaid
flowchart TB
  A[Banner o tab Mi plan] --> B[Ver plan y dias restantes]
  B --> C[Tap Renovar ahora]
  C --> D[App crea preferencia de pago]
  D --> E[Abre Mercado Pago]
  E --> F{Resultado del pago}
  F -->|Aprobado| G[Vuelve a la app]
  G --> H[Membresia vigente nueva fecha]
  F -->|Rechazado o cancelado| I[Mensaje de error]
  I --> J[Reintentar o pagar en recepcion]
```

---

## Diagrama 4 — Gate de membresía al reservar

```mermaid
stateDiagram-v2
  [*] --> IntentandoReservar
  IntentandoReservar --> Active: membresia al dia
  IntentandoReservar --> Grace: en gracia 3 dias
  IntentandoReservar --> Expired: vencida

  Active --> ReservaOK: confirma
  Grace --> ReservaOK: confirma + aviso
  Expired --> Bloqueado: modal Renueva
  Bloqueado --> MiPlan: ir a pagar
  MiPlan --> Active: pago aprobado
```

---

## Diagrama 5 — Secuencia renovar (técnico + producto)

```mermaid
sequenceDiagram
  actor Socio
  participant App as App movil
  participant Edge as Backend
  participant MP as MercadoPago

  Socio->>App: Tap Renovar
  App->>Edge: Crear preferencia
  Edge-->>App: URL checkout
  App->>MP: Abre Checkout Pro
  Socio->>MP: Paga
  MP->>Edge: Webhook aprobado
  Edge->>Edge: Extiende membresia
  MP-->>App: Return URL
  App-->>Socio: Plan renovado
```

---

## Diagrama 6 — Semana del socio

```mermaid
flowchart TB
  subgraph lunes [Lunes]
    L1[Reservar CrossFit jueves]
  end
  subgraph jueves [Jueves]
    J1[Mostrar QR]
    J2[Check-in]
    J3[Registrar peso]
  end
  subgraph domingo [Domingo - vence en 5 dias]
    D1[Banner aviso]
    D2[Renovar con Mercado Pago]
    D3[Membresia OK]
  end

  L1 --> J1
  J1 --> J2
  J2 --> J3
  J3 --> D1
  D1 --> D2
  D2 --> D3
```

---

## Cómo verlos

1. **En Cursor:** abrir este `.md` → Preview (Ctrl+Shift+V) — Mermaid se renderiza.
2. **Al cliente:** exportar a PDF desde la presentación, o pegar capturas de cada diagrama.
3. **Imagen única:** ver `flujo-app-mobile-socio.png` en esta carpeta (si se generó).
