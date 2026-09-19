# Onboarding del socio nuevo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la alarma roja de «sin plan activo» por una bienvenida en Inicio, convertir Agenda en modo explorar y pedir la ficha técnica en el primer ingreso del socio.

**Architecture:** Todo el estado de membresía sale del selector existente `selectMyMembership`, que devuelve `null` cuando el socio nunca tuvo plan. `ExpiryBanner` deja de cubrir ese caso y `HomePage` muestra una tarjeta nueva; `AgendaPage` evalúa la membresía en el render para cambiar el botón de cada sesión; y un guard en `RequireAuth` desvía al socio sin ficha a una ruta `/bienvenida` que monta el wizard ya existente en su modo `isInitialOnboarding`.

**Tech Stack:** React 19 + TypeScript, React Router 7, Tailwind (tokens propios: `acc`, `ink`, `line`, `surface`), Vitest + @testing-library/react, repositorio en memoria (`LocalRepository`) y mocks de `GymRepository` en tests.

**Spec:** `docs/superpowers/specs/2026-09-19-onboarding-socio-nuevo-design.md`

## Global Constraints

- Todos los comandos se ejecutan desde `app/` (`cd app`).
- Tests: `npm test -- --run <ruta>`; suite completa: `npm test -- --run`. Typecheck + build: `npm run build`.
- Textos de UI en español, con tildes, tal como aparecen literalmente en este plan.
- Solo el caso «nunca tuvo plan» (`selectMyMembership` → `null`) cambia el banner. Vencida, gracia y cancelada se conservan: no toques esas ramas de `ExpiryBanner` ni las pruebas ZC18-03, ZC18-04, ZC18-11, ZC18-12.
- Nada de `role="alert"`, rojo (`danger`) ni `animate-pulse` en los componentes nuevos: el tono es marca (`acc`).
- Un CTA que navega es **un solo** elemento enfocable: usa `ButtonLink` de `@/ui/ButtonLink` (Task 2), nunca `<Link><Button>…</Button></Link>`, que anida dos controles para una sola acción (`nested-interactive` en axe).
- Staff y admin no ven ninguno de los avisos nuevos ni el guard de ficha.
- No se agregan columnas ni migraciones en Supabase.
- Sigue el estilo de los archivos vecinos: componentes con `export function`, clases Tailwind inline, comentarios solo para explicar decisiones.

---

### Task 1: Regla de dominio `isFichaPending`

**Files:**
- Create: `app/src/domain/rules/profile.ts`
- Create: `app/src/domain/rules/profile.test.ts`
- Modify: `app/src/domain/rules/index.ts:167-171` (agregar el re-export)

**Interfaces:**
- Consumes: `User` de `app/src/domain/models.ts` (campos opcionales `heightCm`, `initialWeightKg`, y `role: 'member' | 'staff' | 'admin'`).
- Produces: `isFichaPending(user: User | null | undefined): boolean`, reexportada desde `@/domain/rules`. La consume la Task 6.

- [ ] **Step 1: Escribe el test que falla**

Crea `app/src/domain/rules/profile.test.ts`:

```tsx
import { describe, expect, it } from 'vitest'
import type { User } from '../models'
import { isFichaPending } from './profile'

const member: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('isFichaPending', () => {
  it('es true cuando al socio le faltan estatura y peso inicial', () => {
    expect(isFichaPending(member)).toBe(true)
  })

  it('es true cuando solo tiene estatura', () => {
    expect(isFichaPending({ ...member, heightCm: 175 })).toBe(true)
  })

  it('es true cuando solo tiene peso inicial', () => {
    expect(isFichaPending({ ...member, initialWeightKg: 75 })).toBe(true)
  })

  it('es false cuando ya tiene estatura y peso inicial', () => {
    expect(
      isFichaPending({ ...member, heightCm: 175, initialWeightKg: 75 }),
    ).toBe(false)
  })

  it('es false para staff y admin aunque no tengan ficha', () => {
    expect(isFichaPending({ ...member, role: 'staff' })).toBe(false)
    expect(isFichaPending({ ...member, role: 'admin' })).toBe(false)
  })

  it('es false sin usuario', () => {
    expect(isFichaPending(null)).toBe(false)
    expect(isFichaPending(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- --run src/domain/rules/profile.test.ts`
Expected: FAIL — `Failed to resolve import "./profile"`.

- [ ] **Step 3: Implementa la regla**

Crea `app/src/domain/rules/profile.ts`:

```tsx
import type { User } from '../models'

/**
 * Ficha técnica inicial pendiente. Se deriva de los dos campos que el paso 1
 * del wizard siempre guarda, así que no hace falta una marca en la base.
 */
export function isFichaPending(user: User | null | undefined): boolean {
  if (!user || user.role !== 'member') return false
  return user.heightCm == null || user.initialWeightKg == null
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npm test -- --run src/domain/rules/profile.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Reexporta la regla en el barril de dominio**

En `app/src/domain/rules/index.ts`, junto a los otros `export *` del final del archivo:

```tsx
export * from './membership'
export * from './membershipPlan'
export * from './zoneAccess'
export * from './anthropometrics'
export * from './profile'
```

- [ ] **Step 6: Corre la suite de dominio**

Run: `npm test -- --run src/domain/rules/`
Expected: PASS, sin regresiones en `membership.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add app/src/domain/rules/profile.ts app/src/domain/rules/profile.test.ts app/src/domain/rules/index.ts
git commit -m "feat(domain): regla isFichaPending para la ficha tecnica inicial"
```

---

### Task 2: Componente `WelcomeNoPlanCard`

**Files:**
- Create: `app/src/ui/buttonStyles.ts`
- Create: `app/src/ui/ButtonLink.tsx`
- Create: `app/src/ui/ButtonLink.test.tsx`
- Create: `app/src/features/memberships/components/WelcomeNoPlanCard.tsx`
- Create: `app/src/features/memberships/components/WelcomeNoPlanCard.test.tsx`
- Modify: `app/src/ui/primitives.tsx:23-71` (mover estilos a `buttonStyles.ts`)
- Modify: `app/src/features/memberships/components/index.ts`
- Modify: `app/src/features/memberships/index.ts:6-12`

**Interfaces:**
- Consumes: `Card` de `@/ui/primitives`; `Link` de `react-router-dom`.
- Produces: `buttonClasses(variant?, size?, className?): string` con los tipos `ButtonVariant` y `ButtonSize` desde `@/ui/buttonStyles`; `ButtonLink({ to, variant?, size?, className?, children, ...linkProps })` desde `@/ui/ButtonLink` (lo consumen las Tasks 4 y 5); y `WelcomeNoPlanCard({ onlinePayEnabled }: { onlinePayEnabled?: boolean })` desde `@/features/memberships` (la consume la Task 3).

- [ ] **Step 1: Escribe el test que falla**

Crea `app/src/features/memberships/components/WelcomeNoPlanCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WelcomeNoPlanCard } from './WelcomeNoPlanCard'

describe('WelcomeNoPlanCard', () => {
  it('invita a activar el plan sin lenguaje de error', () => {
    render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: /Activa tu plan y empieza a entrenar/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/actívalo en recepción/i)).toBeInTheDocument()
    expect(screen.queryByText(/vencida/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/pausadas/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('enlaza a planes y a explorar áreas', () => {
    render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
      'href',
      '/membresia',
    )
    expect(
      screen.getByRole('link', { name: /explorar áreas/i }),
    ).toHaveAttribute('href', '/explorar')
    // Un CTA que navega es un solo control: sin <button> dentro del <a>.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('menciona el pago en línea solo cuando está habilitado', () => {
    const { unmount } = render(
      <MemoryRouter>
        <WelcomeNoPlanCard />
      </MemoryRouter>,
    )
    expect(
      screen.queryByText(/en línea con tarjeta/i),
    ).not.toBeInTheDocument()
    unmount()

    render(
      <MemoryRouter>
        <WelcomeNoPlanCard onlinePayEnabled />
      </MemoryRouter>,
    )
    expect(screen.getByText(/en línea con tarjeta/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- --run src/features/memberships/components/WelcomeNoPlanCard.test.tsx`
Expected: FAIL — `Failed to resolve import "./WelcomeNoPlanCard"`.

- [ ] **Step 3: Extrae las clases de `Button` y crea `ButtonLink`**

Un CTA que navega debe ser un solo elemento enfocable, así que en vez de envolver un `Button` en un `Link` se usa un `Link` con el estilo del botón. Para no duplicar la cadena de clases, primero se extrae de `Button` a un archivo propio: si se exporta desde `primitives.tsx`, oxlint avisa `only-export-components` (rompe fast refresh mezclar componentes y funciones en un mismo archivo).

Crea `app/src/ui/buttonStyles.ts`:

```tsx
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'outline'
  | 'accent'

export type ButtonSize = 'sm' | 'md' | 'lg'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-acc text-[var(--color-acc-contrast)] font-bold hover:bg-acc-hi active:scale-[0.97] shadow-[var(--shadow-acc)] border border-transparent disabled:opacity-50 disabled:shadow-none',
  accent:
    'bg-acc text-[var(--color-acc-contrast)] font-bold hover:bg-acc-hi active:scale-[0.97] shadow-[var(--shadow-acc)] border border-transparent disabled:opacity-50',
  secondary:
    'bg-surface-elevated text-ink border border-line hover:border-acc/40 hover:bg-surface active:scale-[0.97] disabled:opacity-50',
  outline:
    'bg-transparent text-ink border border-line hover:border-acc/60 hover:bg-acc-soft active:scale-[0.97] disabled:opacity-50',
  ghost:
    'bg-transparent text-ink-2 hover:bg-surface hover:text-ink active:scale-[0.97] disabled:opacity-50',
  danger:
    'bg-danger text-white font-bold hover:brightness-110 active:scale-[0.97] shadow-md shadow-danger/20 disabled:opacity-50',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-5 py-3 text-base rounded-2xl gap-2.5',
}

/** Estilo compartido por `Button` y por los CTA que navegan (`ButtonLink`). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  return `focus-ring inline-flex cursor-pointer items-center justify-center font-semibold transition-[transform,background-color,border-color,box-shadow,filter] duration-150 ease-[var(--ease-out)] select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`
}
```

En `app/src/ui/primitives.tsx`, borra los dos mapas de clases que hoy viven dentro de `Button`, importa el estilo y usa los tipos nuevos:

```tsx
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={`disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 ${buttonClasses(variant, size, className)}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
}
```

Crea `app/src/ui/ButtonLink.tsx`:

```tsx
import { Link, type LinkProps } from 'react-router-dom'
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles'

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

/** CTA que navega: un solo elemento enfocable con el estilo de `Button`. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  )
}
```

Crea `app/src/ui/ButtonLink.test.tsx`, que fija el contrato del que dependen las Tasks 4 y 5 (hoy no hay ningún test bajo `src/ui/`, así que sin este archivo esa ruta no ejecuta nada):

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ButtonLink } from './ButtonLink'

describe('ButtonLink', () => {
  it('es un único elemento enfocable, no un botón dentro de un enlace', () => {
    render(
      <MemoryRouter>
        <ButtonLink to="/membresia">Ver planes</ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Ver planes' })
    expect(link).toHaveAttribute('href', '/membresia')
    expect(link.querySelector('button')).toBeNull()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('aplica variante, tamaño y clases propias sin perder el estilo base', () => {
    render(
      <MemoryRouter>
        <ButtonLink
          to="/agenda"
          variant="secondary"
          size="sm"
          className="shrink-0"
        >
          Explorar
        </ButtonLink>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Explorar' })
    expect(link).toHaveClass('shrink-0')
    expect(link).toHaveClass('border-line')
    expect(link).toHaveClass('px-3')
    expect(link).toHaveClass('focus-ring')
  })

  it('reenvía los atributos del enlace, como aria-label', () => {
    render(
      <MemoryRouter>
        <ButtonLink
          to="/membresia"
          aria-label="Activar plan para reservar CrossFit WOD Power"
        >
          Activar plan
        </ButtonLink>
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('link', {
        name: 'Activar plan para reservar CrossFit WOD Power',
      }),
    ).toBeInTheDocument()
  })
})
```

Run: `npm test -- --run src/ui/`
Expected: PASS — 3 tests.

- [ ] **Step 4: Implementa el componente**

Crea `app/src/features/memberships/components/WelcomeNoPlanCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

interface WelcomeNoPlanCardProps {
  /** Con VITE_ONLINE_PAYMENTS activo se menciona el pago con tarjeta */
  onlinePayEnabled?: boolean
}

export function WelcomeNoPlanCard({
  onlinePayEnabled = false,
}: WelcomeNoPlanCardProps) {
  return (
    <Card
      data-testid="welcome-no-plan"
      className="relative overflow-hidden border-acc/25 p-0"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-acc-glow blur-3xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc">
          <Sparkles className="h-3.5 w-3.5" />
          Primer paso
        </div>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
          Activa tu plan y empieza a entrenar
        </h2>
        <p className="mt-1.5 text-sm text-ink-2">
          Tu cuenta ya está lista. Elige el plan que se ajuste a tus objetivos y
          {onlinePayEnabled
            ? ' actívalo en línea con tarjeta o en recepción.'
            : ' actívalo en recepción.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonLink to="/membresia" size="sm">
            Ver planes
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <Link
            to="/explorar"
            className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
          >
            Explorar áreas
          </Link>
        </div>
      </div>
    </Card>
  )
}
```

- [ ] **Step 5: Corre el test y verifica que pasa**

Run: `npm test -- --run src/features/memberships/components/WelcomeNoPlanCard.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 6: Expórtalo en los dos barriles**

En `app/src/features/memberships/components/index.ts` agrega la línea:

```tsx
export { WelcomeNoPlanCard } from './WelcomeNoPlanCard'
```

En `app/src/features/memberships/index.ts`, dentro del bloque que reexporta desde `./components`:

```tsx
export {
  MembershipCard,
  RenewalNoticeCard,
  PlansShowcase,
  PaymentRow,
  PaymentHistory,
  WelcomeNoPlanCard,
} from './components'
```

- [ ] **Step 7: Commit**

```bash
git add app/src/ui/buttonStyles.ts app/src/ui/primitives.tsx app/src/ui/ButtonLink.tsx app/src/ui/ButtonLink.test.tsx app/src/features/memberships/components/WelcomeNoPlanCard.tsx app/src/features/memberships/components/WelcomeNoPlanCard.test.tsx app/src/features/memberships/components/index.ts app/src/features/memberships/index.ts
git commit -m "feat(memberships): tarjeta de bienvenida para socio sin plan"
```

---

### Task 3: Inicio muestra la bienvenida y el banner se calla

**Files:**
- Create: `app/src/test/mockRepo.ts`
- Create: `app/src/features/memberships/onlinePay.ts`
- Create: `app/src/features/catalog/HomePage.test.tsx`
- Modify: `app/src/features/memberships/components/ExpiryBanner.tsx:38-65` (eliminar la rama «sin membresía»)
- Modify: `app/src/features/memberships/components/ExpiryBanner.test.tsx:228-250` (invertir la aserción)
- Modify: `app/src/features/catalog/HomePage.tsx:1-17` (imports), `:31` (membresía) y `:115-132` (rama del hero)
- Modify: `app/src/features/memberships/MiPlanPage.tsx:28-30` (usar el helper compartido)
- Modify: `app/src/features/memberships/index.ts` (exportar el helper)
- Modify: `docs/tecnico/qa-checklists/ZCAPP-18-mi-plan-historial.md:55` (fila ZC18-O1)

**Interfaces:**
- Consumes: `WelcomeNoPlanCard` de la Task 2; `selectMyMembership(state, userId, now?)` de `@/app/store`.
- Produces: `isOnlinePayEnabled(): boolean` exportada desde `@/features/memberships` (la consumen `HomePage` y `MiPlanPage`), y `createMockRepo(user: User, state: Partial<GymState>): GymRepository` en `@/test/mockRepo` (la consumen las Tasks 5 y 6).

- [ ] **Step 1: Crea el factory de repositorio para tests**

Los tests existentes repiten este objeto en cada archivo. Como las Tasks 5 y 6 lo necesitan igual, va una sola vez en `app/src/test/mockRepo.ts` (archivo sin `.test.`, así que Vitest no lo toma como suite). No refactorices los tests que ya lo tienen copiado.

```tsx
import { vi } from 'vitest'
import type { GymRepository } from '@/data/types'
import type { GymState, User } from '@/domain/models'

/** Repositorio en memoria para tests de componentes y rutas. */
export function createMockRepo(
  user: User,
  state: Partial<GymState> = {},
): GymRepository {
  const fullState: GymState = {
    settings: {
      name: 'Zona Cero',
      logoUrl: null,
      primaryColor: '#000',
      accentColor: '#F26D17',
      bookingWindowHours: 72,
      cancelWindowHours: 2,
      checkInWindowMinutes: 20,
    },
    users: [user],
    trainers: [],
    zones: [],
    templates: [],
    sessions: [],
    bookings: [],
    waitlist: [],
    checkIns: [],
    measurements: [],
    membershipPlans: [],
    memberships: [],
    payments: [],
    ...state,
  }

  return {
    getCurrentUser: vi.fn().mockResolvedValue(user),
    load: vi.fn().mockResolvedValue(fullState),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
    listBookingsForUser: vi.fn().mockResolvedValue([]),
    createBooking: vi.fn().mockResolvedValue({ id: 'bk_1', status: 'confirmed' }),
    cancelBooking: vi.fn(),
    rescheduleBooking: vi.fn(),
    checkIn: vi.fn(),
    listMeasurements: vi.fn().mockResolvedValue([]),
    createMeasurement: vi.fn(),
    updateMeasurement: vi.fn(),
    deleteMeasurement: vi.fn(),
    getBodyGoal: vi.fn().mockResolvedValue(null),
    upsertBodyGoal: vi.fn(),
    updateSettings: vi.fn(),
    listZones: vi.fn().mockResolvedValue(fullState.zones),
    upsertZone: vi.fn(),
    deleteZone: vi.fn(),
    listTemplates: vi.fn().mockResolvedValue([]),
    upsertTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    listSessions: vi.fn().mockResolvedValue(fullState.sessions),
    upsertSession: vi.fn(),
    deleteSession: vi.fn(),
    getMembershipPlans: vi.fn().mockResolvedValue(fullState.membershipPlans),
    upsertMembershipPlan: vi.fn(),
    deleteMembershipPlan: vi.fn(),
    getMemberMembership: vi.fn().mockResolvedValue(null),
    getMemberPayments: vi.fn().mockResolvedValue([]),
    listMemberships: vi.fn().mockResolvedValue(fullState.memberships),
    listPayments: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([user]),
    registerManualPayment: vi.fn(),
  }
}
```

Si `tsc` reclama por alguna propiedad de `GymRepository` que falte o sobre, ajústala mirando `app/src/data/types.ts`; no cambies la interfaz del repositorio.

- [ ] **Step 2: Escribe el test que falla en Inicio**

Crea `app/src/features/catalog/HomePage.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '@/features/catalog/HomePage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { Booking, Membership, Session, User } from '@/domain/models'

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const DAY_MS = 24 * 60 * 60 * 1000

const activeMembership: Membership = {
  id: 'mem_1',
  userId: memberUser.id,
  planId: 'plan_1',
  status: 'active',
  startsAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() + 23 * DAY_MS).toISOString(),
  visitsLeft: null,
}

function renderHome() {
  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <HomePage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('HomePage — hero del socio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('socio sin plan ve la bienvenida en lugar de "Sin reservas próximas"', async () => {
    resetRepositoryForTests(createMockRepo(memberUser, { memberships: [] }))

    renderHome()

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Sin reservas próximas/i),
    ).not.toBeInTheDocument()
  })

  it('socio con plan activo y sin reservas ve "Sin reservas próximas"', async () => {
    resetRepositoryForTests(
      createMockRepo(memberUser, { memberships: [activeMembership] }),
    )

    renderHome()

    expect(
      await screen.findByText(/Sin reservas próximas/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Activa tu plan y empieza a entrenar/i),
    ).not.toBeInTheDocument()
  })

  it('socio con reserva próxima ve su próxima clase', async () => {
    const session: Session = {
      id: 'ses_1',
      templateId: 'tpl_1',
      zoneId: 'zone-crossfit',
      title: 'CrossFit WOD Power',
      kind: 'class',
      startsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      capacity: 18,
      trainerId: null,
      bookedCount: 1,
    }
    const booking: Booking = {
      id: 'bk_1',
      sessionId: session.id,
      userId: memberUser.id,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    }

    resetRepositoryForTests(
      createMockRepo(memberUser, {
        memberships: [activeMembership],
        sessions: [session],
        bookings: [booking],
      }),
    )

    renderHome()

    expect(await screen.findByText(/Tu próxima clase/i)).toBeInTheDocument()
    expect(screen.getByText('CrossFit WOD Power')).toBeInTheDocument()
    expect(
      screen.queryByText(/Activa tu plan y empieza a entrenar/i),
    ).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Corre el test y verifica que falla**

Run: `npm test -- --run src/features/catalog/HomePage.test.tsx`
Expected: FAIL — el primer caso no encuentra «Activa tu plan y empieza a entrenar» porque hoy se renderiza «Sin reservas próximas».

Nota: si `Booking` pide campos que este plan no lista, revisa `app/src/domain/models.ts` y complétalos con valores mínimos; no cambies el modelo.

- [ ] **Step 4: Extrae el helper de pago en línea**

Crea `app/src/features/memberships/onlinePay.ts`:

```tsx
import { isSupabaseConfigured } from '@/data/supabaseRepository'

/** Datafast Dataweb — activar con VITE_ONLINE_PAYMENTS=1 + secrets DATAFAST_* */
export function isOnlinePayEnabled(): boolean {
  return import.meta.env.VITE_ONLINE_PAYMENTS === '1' && isSupabaseConfigured()
}
```

Expórtalo en `app/src/features/memberships/index.ts`:

```tsx
export { isOnlinePayEnabled } from './onlinePay'
```

Y en `app/src/features/memberships/MiPlanPage.tsx` reemplaza el cálculo local (líneas 28-30) por el helper:

```tsx
import { isOnlinePayEnabled } from './onlinePay'

// ...dentro del componente
const onlinePayEnabled = isOnlinePayEnabled()
```

Quita el import de `isSupabaseConfigured` en `MiPlanPage.tsx` si queda sin uso.

- [ ] **Step 5: Conecta la bienvenida en Inicio**

En `app/src/features/catalog/HomePage.tsx` agrega los imports:

```tsx
import { selectMyMembership } from '@/app/store'
import { WelcomeNoPlanCard, isOnlinePayEnabled } from '@/features/memberships'
```

Después de `const mine = ...` agrega:

```tsx
  const membership = selectMyMembership(data, user.id)
```

Y cambia el bloque del hero (hoy un ternario de dos ramas en las líneas 84-132) por tres ramas, dejando intactos el contenido de la tarjeta de próxima clase y el de «Sin reservas próximas»:

```tsx
      {next?.session ? (
        <Card className="relative overflow-hidden border-acc/25 p-0">
          {/* ...contenido existente de "Tu próxima clase", sin cambios... */}
        </Card>
      ) : !membership ? (
        <WelcomeNoPlanCard onlinePayEnabled={isOnlinePayEnabled()} />
      ) : (
        <Card className="flex flex-col items-start gap-3 border-dashed sm:flex-row sm:items-center sm:justify-between">
          {/* ...contenido existente de "Sin reservas próximas", sin cambios... */}
        </Card>
      )}
```

- [ ] **Step 6: Corre el test de Inicio**

Run: `npm test -- --run src/features/catalog/HomePage.test.tsx`
Expected: PASS — 3 tests.

- [ ] **Step 7: Silencia el banner para «sin plan»**

En `app/src/features/memberships/components/ExpiryBanner.tsx`, reemplaza todo el bloque de la rama «sin membresía» (desde `// 1. Expired or No Membership Banner` hasta el cierre del `if (!membership) { ... }`, líneas 38-65) por:

```tsx
  // Sin membresía: Inicio muestra la bienvenida (WelcomeNoPlanCard); acá no va aviso.
  if (!membership) {
    return null
  }
```

Quita `ShieldAlert` del import de `lucide-react` si queda sin uso.

- [ ] **Step 8: Invierte el test del banner**

En `app/src/features/memberships/components/ExpiryBanner.test.tsx`, reemplaza el caso `renders No Membership Banner when member has no membership` (líneas 228-250) por:

```tsx
  it('does not render banner when member has no membership (bienvenida en Inicio)', async () => {
    const mockRepo = createMockRepo(memberUser, {
      memberships: [],
    })
    resetRepositoryForTests(mockRepo)

    const { container } = render(
      <MemoryRouter>
        <RepositoryProvider>
          <ExpiryBanner now={now} />
        </RepositoryProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('expiry-banner')).not.toBeInTheDocument()
    })
    expect(container).toBeEmptyDOMElement()
  })
```

Agrega `waitFor` al import de `@testing-library/react` en ese archivo si no está.

- [ ] **Step 9: Corre los tests de membresías y de Inicio**

Run: `npm test -- --run src/features/memberships/ src/features/catalog/HomePage.test.tsx`
Expected: PASS, incluidos los casos de vencida, gracia y aviso cercano.

- [ ] **Step 10: Actualiza el checklist de ZCAPP-18**

En `docs/tecnico/qa-checklists/ZCAPP-18-mi-plan-historial.md`, cambia la fila de ZC18-O1 por:

```markdown
| ZC18-O1 | Banner sin membresía decía «Membresía vencida» | Baja | **Corregido** → el banner ya no aparece sin plan; Inicio muestra la bienvenida «Activa tu plan y empieza a entrenar» |
```

- [ ] **Step 11: Commit**

```bash
git add app/src/test/mockRepo.ts app/src/features/catalog/HomePage.tsx app/src/features/catalog/HomePage.test.tsx app/src/features/memberships/onlinePay.ts app/src/features/memberships/index.ts app/src/features/memberships/MiPlanPage.tsx app/src/features/memberships/components/ExpiryBanner.tsx app/src/features/memberships/components/ExpiryBanner.test.tsx docs/tecnico/qa-checklists/ZCAPP-18-mi-plan-historial.md
git commit -m "feat(inicio): bienvenida para socio sin plan en lugar de banner rojo"
```

---

### Task 4: Componente `PlanRequiredNotice`

**Files:**
- Create: `app/src/features/memberships/components/PlanRequiredNotice.tsx`
- Create: `app/src/features/memberships/components/PlanRequiredNotice.test.tsx`
- Modify: `app/src/features/memberships/components/index.ts`
- Modify: `app/src/features/memberships/index.ts`

**Interfaces:**
- Consumes: `ButtonLink` de `@/ui/ButtonLink` (Task 2), con firma `ButtonLink({ to, variant?, size?, className?, children, ...linkProps })`.
- Produces: `PlanRequiredNotice()` (sin props), exportada desde `@/features/memberships`. La consume la Task 5.

- [ ] **Step 1: Escribe el test que falla**

Crea `app/src/features/memberships/components/PlanRequiredNotice.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanRequiredNotice } from './PlanRequiredNotice'

describe('PlanRequiredNotice', () => {
  it('explica que está explorando y enlaza a planes', () => {
    render(
      <MemoryRouter>
        <PlanRequiredNotice />
      </MemoryRouter>,
    )

    expect(
      screen.getByText(/Estás explorando la agenda\. Activa tu plan para reservar\./i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver planes/i })).toHaveAttribute(
      'href',
      '/membresia',
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- --run src/features/memberships/components/PlanRequiredNotice.test.tsx`
Expected: FAIL — `Failed to resolve import "./PlanRequiredNotice"`.

- [ ] **Step 3: Implementa el componente**

Crea `app/src/features/memberships/components/PlanRequiredNotice.tsx`:

```tsx
import { ArrowRight, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/ui/ButtonLink'

export function PlanRequiredNotice() {
  return (
    <div
      data-testid="plan-required-notice"
      className="flex flex-col gap-3 rounded-2xl border border-acc/30 bg-acc/10 p-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-2 sm:text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-acc" />
        Estás explorando la agenda. Activa tu plan para reservar.
      </p>
      <ButtonLink to="/membresia" size="sm" className="shrink-0">
        Ver planes
        <ArrowRight className="h-4 w-4" />
      </ButtonLink>
    </div>
  )
}
```

- [ ] **Step 4: Corre el test y verifica que pasa**

Run: `npm test -- --run src/features/memberships/components/PlanRequiredNotice.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Expórtalo en los dos barriles**

En `app/src/features/memberships/components/index.ts`:

```tsx
export { PlanRequiredNotice } from './PlanRequiredNotice'
```

En `app/src/features/memberships/index.ts`, dentro del bloque que reexporta desde `./components`, agrega `PlanRequiredNotice` a la lista (queda junto a `WelcomeNoPlanCard`).

- [ ] **Step 6: Commit**

```bash
git add app/src/features/memberships/components/PlanRequiredNotice.tsx app/src/features/memberships/components/PlanRequiredNotice.test.tsx app/src/features/memberships/components/index.ts app/src/features/memberships/index.ts
git commit -m "feat(memberships): aviso suave de plan requerido para la agenda"
```

---

### Task 5: Agenda en modo explorar

**Files:**
- Create: `app/src/features/agenda/agendaPlanRequired.test.tsx`
- Modify: `app/src/features/agenda/AgendaPage.tsx:1-44` (imports), `:55` (estado derivado), `:143-169` (mensaje del gate), `:245-249` (aviso) y `:544-570` (botón por sesión)
- Modify: `app/src/features/memberships/components/BookingGateModal.tsx:26-38` y `:60-72`, `:93-101`

**Interfaces:**
- Consumes: `PlanRequiredNotice` de la Task 4; `createMockRepo` de `@/test/mockRepo` (Task 3); `selectMyMembership` de `@/app/store`; `canBookMembership` de `@/domain/rules`, que devuelve `{ allowed: boolean; status: MembershipStatus | 'none'; reason?: string }`.
- Produces: nada para tareas posteriores.

- [ ] **Step 1: Escribe el test que falla**

Crea `app/src/features/agenda/agendaPlanRequired.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, Membership, Session, User, Zone } from '@/domain/models'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})

const memberUser: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const staffUser: User = {
  id: 'user_staff_1',
  email: 'staff@gym.local',
  fullName: 'Staff Zona Cero',
  role: 'staff',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const zones: Zone[] = [
  {
    id: 'zone-crossfit',
    name: 'CrossFit',
    type: 'crossfit',
    description: 'CrossFit',
    defaultCapacity: 18,
    imageHint: 'crossfit',
  },
]

const sessions: Session[] = [
  {
    id: 'ses_cf',
    templateId: 'tpl_cf',
    zoneId: 'zone-crossfit',
    title: 'CrossFit WOD Power',
    kind: 'class',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
    capacity: 18,
    trainerId: null,
    bookedCount: 0,
  },
]

const DAY_MS = 24 * 60 * 60 * 1000

const activeMembership: Membership = {
  id: 'mem_1',
  userId: memberUser.id,
  planId: 'plan_1',
  status: 'active',
  startsAt: new Date(Date.now() - 5 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() + 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() + 23 * DAY_MS).toISOString(),
  visitsLeft: null,
}

const expiredMembership: Membership = {
  ...activeMembership,
  id: 'mem_old',
  startsAt: new Date(Date.now() - 60 * DAY_MS).toISOString(),
  endsAt: new Date(Date.now() - 20 * DAY_MS).toISOString(),
  graceEndsAt: new Date(Date.now() - 17 * DAY_MS).toISOString(),
}

function renderAgenda(user: User, state: Partial<GymState>) {
  resetRepositoryForTests(
    createMockRepo(user, { zones, sessions, ...state }),
  )

  return render(
    <MemoryRouter>
      <RepositoryProvider>
        <AgendaPage />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('AgendaPage — socio sin plan puede explorar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('socio sin plan ve el aviso y el botón "Activar plan" en vez de "Reservar"', async () => {
    renderAgenda(memberUser, { memberships: [] })

    expect(
      await screen.findByTestId('plan-required-notice'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: /Activar plan para reservar CrossFit WOD Power/i,
      }),
    ).toHaveAttribute('href', '/membresia')
    expect(
      screen.queryByRole('button', { name: /^Reservar$/i }),
    ).not.toBeInTheDocument()
  })

  it('socio vencido ve "Renovar plan" y no ve el aviso de exploración', async () => {
    renderAgenda(memberUser, { memberships: [expiredMembership] })

    expect(
      await screen.findByRole('link', {
        name: /Renovar plan para reservar CrossFit WOD Power/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })

  it('socio con plan activo conserva el botón "Reservar"', async () => {
    renderAgenda(memberUser, { memberships: [activeMembership] })

    expect(
      await screen.findByRole('button', { name: /^Reservar$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })

  it('staff no ve el aviso ni pierde su botón de reserva', async () => {
    renderAgenda(staffUser, { memberships: [] })

    expect(
      await screen.findByRole('button', { name: /^Reservar$/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('plan-required-notice'),
    ).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- --run src/features/agenda/agendaPlanRequired.test.tsx`
Expected: FAIL — no existe `plan-required-notice` y el botón sigue siendo «Reservar».

- [ ] **Step 3: Deriva el estado de plan en AgendaPage**

En `app/src/features/agenda/AgendaPage.tsx` agrega a los imports:

```tsx
import { Lock } from 'lucide-react'
import { ButtonLink } from '@/ui/ButtonLink'
import { BookingGateModal, PlanRequiredNotice, type BookingGateType } from '@/features/memberships'
```

Respeta la forma actual de los imports del archivo: `Lock` va junto a los demás iconos de `lucide-react` y `PlanRequiredNotice` se suma al import existente de `@/features/memberships`.

Debajo de `const isStaffOrAdmin = ...` (línea 55) agrega:

```tsx
  const isMember = user?.role === 'member'

  const membership = useMemo(
    () => (user ? selectMyMembership(data, user.id) : null),
    [data, user],
  )

  // Estado de plan evaluado en el render: el botón de cada sesión no debe
  // invitar a un clic que siempre falla.
  const planStatus = useMemo(
    () => canBookMembership(membership).status,
    [membership],
  )
  const neverHadPlan = isMember && planStatus === 'none'
  const needsPlan =
    isMember &&
    (planStatus === 'none' ||
      planStatus === 'expired' ||
      planStatus === 'cancelled')
```

- [ ] **Step 4: Muestra el aviso y cambia el botón**

Justo después del bloque `{msg ? (...) : null}` (líneas 245-249) agrega:

```tsx
      {neverHadPlan ? <PlanRequiredNotice /> : null}
```

Y en el bloque de acciones de cada sesión (líneas 546-556) envuelve el botón del socio:

```tsx
                            {needsPlan ? (
                              <ButtonLink
                                to="/membresia"
                                variant="secondary"
                                className="flex-1 !px-2.5 !py-1 text-[10px] h-7 gap-1 border-acc/40 text-acc hover:bg-acc/10"
                                aria-label={`${neverHadPlan ? 'Activar' : 'Renovar'} plan para reservar ${s.title}`}
                              >
                                <Lock className="h-3 w-3" />
                                {neverHadPlan ? 'Activar plan' : 'Renovar plan'}
                              </ButtonLink>
                            ) : (
                              <Button
                                variant={isFull ? 'secondary' : 'primary'}
                                className="!px-2.5 !py-1 text-[10px] h-7 flex-1"
                                disabled={busyId === s.id}
                                onClick={() => void onBook(s.id)}
                              >
                                {isFull ? 'Lista Espera' : 'Reservar'}
                              </Button>
                            )}
```

- [ ] **Step 5: Corrige el mensaje del gate en AgendaPage**

Reemplaza el `reason` fijo dentro de `onBook` (líneas 157-168) por un mensaje que distinga los tres casos:

```tsx
      if (!memCheck.allowed) {
        const gateType: BookingGateType =
          memCheck.status === 'none' ? 'no_membership' : 'membership_expired'
        const reason =
          memCheck.status === 'none'
            ? 'Para reservar necesitas un plan activo. Elige tu plan en Mi Plan y actívalo en recepción.'
            : memCheck.status === 'expired' || memCheck.status === 'cancelled'
              ? 'Tu membresía está vencida. Renueva tu plan para volver a reservar.'
              : (memCheck.reason ?? 'No puedes crear nuevas reservas ahora.')
        setGateModal({
          isOpen: true,
          type: gateType,
          message: reason,
        })
        setMsg(reason)
        return
      }
```

- [ ] **Step 6: Ajusta el gate para «plan requerido»**

En `app/src/features/memberships/components/BookingGateModal.tsx`:

Cambia el texto por defecto (líneas 34-38) para que `no_membership` no hable de vencimiento:

```tsx
  const isNoMembership = type === 'no_membership'

  const description =
    message ||
    (isZoneRestricted
      ? `Tu plan actual no incluye acceso al área ${zoneName || 'seleccionada'}. Consulta en recepción para actualizar tu plan.`
      : isNoMembership
        ? 'Para reservar necesitas un plan activo. Elige tu plan en Mi Plan y actívalo en recepción.'
        : 'No puedes crear nuevas reservas: Tu membresía está vencida. Acércate a recepción.')
```

Cambia el chip del icono (líneas 61-72) para que solo el vencimiento siga en rojo:

```tsx
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isZoneRestricted || isNoMembership
                ? 'bg-warn/15 text-warn'
                : 'bg-danger/15 text-danger'
            }`}
          >
            {isZoneRestricted ? (
              <Lock className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>
```

Y el botón de acción (líneas 93-101):

```tsx
          <Button
            type="button"
            variant={isZoneRestricted || isNoMembership ? 'primary' : 'danger'}
            className="flex-1 gap-2"
            onClick={handleGoToMembership}
          >
            <span>Ir a Mi plan</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
```

- [ ] **Step 7: Corre los tests de agenda y del gate**

Run: `npm test -- --run src/features/agenda/ src/features/memberships/`
Expected: PASS — los 4 casos nuevos más `multizoneAgenda.test.tsx` y `StaffBooking.test.tsx` sin regresiones.

Si `multizoneAgenda.test.tsx` falla porque su socio de prueba no tiene membresía y ahora ve «Activar plan», corrige ese test agregando una membresía activa al estado del mock; no debilites las aserciones nuevas.

- [ ] **Step 8: Commit**

```bash
git add app/src/features/agenda/AgendaPage.tsx app/src/features/agenda/agendaPlanRequired.test.tsx app/src/features/agenda/multizoneAgenda.test.tsx app/src/features/memberships/components/BookingGateModal.tsx
git commit -m "feat(agenda): modo explorar con CTA de plan para socio sin membresia"
```

---

### Task 6: Ficha técnica en el primer ingreso

**Files:**
- Create: `app/src/features/profile/fichaOnboarding.ts`
- Create: `app/src/features/profile/WelcomeFichaPage.tsx`
- Create: `app/src/features/profile/welcomeFicha.test.tsx`
- Modify: `app/src/features/profile/FichaTecnicaModal.tsx:19-23` (prop) y `:606-613` (pie)
- Modify: `app/src/app/RequireAuth.tsx`
- Modify: `app/src/app/router.tsx:62-76` (lazy) y `:93-94` (ruta)

**Interfaces:**
- Consumes: `isFichaPending(user)` de la Task 1 (vía `@/domain/rules`); `createMockRepo` de `@/test/mockRepo` (Task 3); `FichaTecnicaModal({ open, onClose, isInitialOnboarding?, onSkip? })`.
- Produces: `markFichaSkipped(): void` y `wasFichaSkipped(): boolean` en `@/features/profile/fichaOnboarding`; componente `WelcomeFichaPage()` montado en la ruta `/bienvenida`.

- [ ] **Step 1: Escribe el test que falla**

Crea `app/src/features/profile/welcomeFicha.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppRouter } from '@/app/router'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { resetRepositoryForTests } from '@/data/repository'
import { createMockRepo } from '@/test/mockRepo'
import type { GymState, User } from '@/domain/models'

const memberSinFicha: User = {
  id: 'user_member_1',
  email: 'socio@gym.local',
  fullName: 'Ana Socio',
  role: 'member',
  createdAt: '2026-01-01T00:00:00.000Z',
}

const memberConFicha: User = {
  ...memberSinFicha,
  heightCm: 170,
  initialWeightKg: 68,
}

const staffSinFicha: User = {
  ...memberSinFicha,
  id: 'user_staff_1',
  role: 'staff',
}

function renderApp(user: User, state: Partial<GymState> = {}) {
  resetRepositoryForTests(createMockRepo(user, state))

  return render(
    <MemoryRouter initialEntries={['/']}>
      <RepositoryProvider>
        <AppRouter />
      </RepositoryProvider>
    </MemoryRouter>,
  )
}

describe('Primer ingreso — ficha técnica', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('socio sin ficha aterriza en la ficha técnica inicial', async () => {
    renderApp(memberSinFicha)

    expect(
      await screen.findByText('Ficha Técnica Inicial de Ingreso'),
    ).toBeInTheDocument()
  })

  it('socio con ficha completa entra directo a Inicio', async () => {
    renderApp(memberConFicha)

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })

  it('"Completarla después" deja entrar a la app en esta sesión', async () => {
    renderApp(memberSinFicha)

    await screen.findByText('Ficha Técnica Inicial de Ingreso')
    await userEvent.click(
      screen.getByRole('button', { name: /Completarla después/i }),
    )

    expect(
      await screen.findByText(/Activa tu plan y empieza a entrenar/i),
    ).toBeInTheDocument()
  })

  it('staff nunca es desviado a la ficha', async () => {
    renderApp(staffSinFicha)

    // Espera a que Inicio termine de cargar antes de negar la ficha.
    expect(await screen.findByText(/Áreas disponibles/i)).toBeInTheDocument()
    expect(
      screen.queryByText('Ficha Técnica Inicial de Ingreso'),
    ).not.toBeInTheDocument()
  })
})
```

No mockees `react-router-dom` en este archivo: las pruebas necesitan la navegación real del guard.

- [ ] **Step 2: Corre el test y verifica que falla**

Run: `npm test -- --run src/features/profile/welcomeFicha.test.tsx`
Expected: FAIL — el socio sin ficha aterriza en Inicio, no existe la ruta `/bienvenida`.

- [ ] **Step 3: Crea el módulo de la marca de «después»**

Crea `app/src/features/profile/fichaOnboarding.ts`:

```tsx
const FICHA_SKIP_KEY = 'zc.ficha.skipped'

/**
 * El socio eligió completar la ficha después. La marca dura solo esta sesión
 * del navegador, así que en el siguiente ingreso se le vuelve a ofrecer.
 */
export function markFichaSkipped(): void {
  try {
    sessionStorage.setItem(FICHA_SKIP_KEY, '1')
  } catch {
    // Storage bloqueado (modo privado): la ficha se volverá a ofrecer.
  }
}

export function wasFichaSkipped(): boolean {
  try {
    return sessionStorage.getItem(FICHA_SKIP_KEY) === '1'
  } catch {
    return false
  }
}
```

- [ ] **Step 4: Agrega el enlace «Completarla después» al wizard**

En `app/src/features/profile/FichaTecnicaModal.tsx` extiende las props (líneas 19-23 y la desestructuración de la línea 34-38):

```tsx
interface FichaTecnicaModalProps {
  open: boolean
  onClose: () => void
  isInitialOnboarding?: boolean
  /** Solo en onboarding: permite entrar a la app y llenar la ficha después */
  onSkip?: () => void
}

export function FichaTecnicaModal({
  open,
  onClose,
  isInitialOnboarding = false,
  onSkip,
}: FichaTecnicaModalProps) {
```

Y en el pie, reemplaza el `div` del slot izquierdo del paso 1 (líneas 607-613) por:

```tsx
                  <div>
                    {!isInitialOnboarding ? (
                      <Button type="button" variant="ghost" onClick={onClose}>
                        Cancelar
                      </Button>
                    ) : onSkip ? (
                      <button
                        type="button"
                        onClick={onSkip}
                        className="text-xs font-semibold text-ink-3 underline-offset-2 transition hover:text-ink hover:underline"
                      >
                        Completarla después
                      </button>
                    ) : null}
                  </div>
```

- [ ] **Step 5: Crea la página de bienvenida**

Crea `app/src/features/profile/WelcomeFichaPage.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { FichaTecnicaModal } from './FichaTecnicaModal'
import { markFichaSkipped } from './fichaOnboarding'

/**
 * Primer ingreso del socio: vive fuera de AppLayout para que no haya barra de
 * navegación por donde salir sin completar la ficha.
 */
export function WelcomeFichaPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg">
      <FichaTecnicaModal
        open
        isInitialOnboarding
        onClose={() => navigate('/', { replace: true })}
        onSkip={() => {
          markFichaSkipped()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}
```

- [ ] **Step 6: Registra la ruta**

En `app/src/app/router.tsx` agrega el import diferido junto a los demás:

```tsx
const WelcomeFichaPage = lazy(() =>
  import('@/features/profile/WelcomeFichaPage').then((m) => ({
    default: m.WelcomeFichaPage,
  })),
)
```

Y la ruta dentro de `RequireAuth` pero fuera de `AppLayout`:

```tsx
        <Route element={<RequireAuth />}>
          <Route path="bienvenida" element={<WelcomeFichaPage />} />
          <Route element={<AppLayout />}>
```

- [ ] **Step 7: Agrega el guard**

Reemplaza `app/src/app/RequireAuth.tsx` por:

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { isFichaPending } from '@/domain/rules'
import { wasFichaSkipped } from '@/features/profile/fichaOnboarding'
import { Spinner } from '@/ui/primitives'

export function RequireAuth() {
  const user = useCurrentUser()
  const { loading } = useGym()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  // Primer ingreso del socio: la ficha técnica va antes de entrar a la app.
  if (
    isFichaPending(user) &&
    !wasFichaSkipped() &&
    location.pathname !== '/bienvenida'
  ) {
    return <Navigate to="/bienvenida" replace />
  }
  return <Outlet />
}
```

- [ ] **Step 8: Corre el test y verifica que pasa**

Run: `npm test -- --run src/features/profile/`
Expected: PASS — los 4 casos nuevos más `FichaTecnicaModal.test.tsx` sin regresiones.

- [ ] **Step 9: Commit**

```bash
git add app/src/features/profile/fichaOnboarding.ts app/src/features/profile/WelcomeFichaPage.tsx app/src/features/profile/welcomeFicha.test.tsx app/src/features/profile/FichaTecnicaModal.tsx app/src/app/RequireAuth.tsx app/src/app/router.tsx
git commit -m "feat(onboarding): ficha tecnica inicial en el primer ingreso del socio"
```

---

### Task 7: Regresión completa y cierre

**Files:**
- Modify: ninguno salvo correcciones que salgan de la regresión.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Corre la suite completa**

Run: `npm test -- --run`
Expected: PASS en todos los archivos. Presta atención a `src/test/qaZcapp18MiPlan.test.tsx`, `src/test/seniorQaExploratory.test.ts` y `src/test/e2eFlows.test.ts`.

- [ ] **Step 2: Verifica tipos y build**

Run: `npm run build`
Expected: `tsc -b` sin errores y build de Vite exitoso.

- [ ] **Step 3: Corre el linter**

Run: `npm run lint`
Expected: sin hallazgos nuevos respecto a `main`.

- [ ] **Step 4: Commit de cierre si hubo correcciones**

```bash
git add -A app/src docs
git commit -m "fix(onboarding): ajustes de regresion tras la suite completa"
```

Si la regresión salió limpia y no hubo cambios, omite este commit.

## Verificación manual sugerida (staging)

1. Socio nuevo sin plan en `/`: ve «Activa tu plan y empieza a entrenar», sin franja roja arriba.
2. Ese mismo socio en `/agenda`: ve el aviso de exploración y botones «Activar plan» que llevan a `/membresia`.
3. Socio con membresía vencida: sigue viendo el banner rojo arriba y botones «Renovar plan» en Agenda.
4. Socio con plan activo: Agenda con «Reservar» y reserva funcionando.
5. Cuenta nueva confirmando el correo: aterriza en `/bienvenida`; al completar la ficha llega a Inicio; con «Completarla después» entra y en el siguiente ingreso se le vuelve a pedir.
