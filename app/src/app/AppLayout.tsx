import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  CreditCard,
  Dumbbell,
  Layers,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Settings,
  TicketCheck,
  User,
  Home,
  QrCode,
  Sparkles,
} from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useGym,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import { selectMyMembership } from '@/app/store'
import { canUseBookingNav, displayInitials } from '@/domain/rules'
import { ExpiryBanner, PlanRequiredNotice } from '@/features/memberships'
import {
  markNoPlanReminderDismissed,
  wasNoPlanReminderDismissed,
} from '@/features/memberships/noPlanReminder'
import { Button } from '@/ui/primitives'

const memberDesktopNav = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/reservas', label: 'Mis Reservas', icon: TicketCheck },
  { to: '/membresia', label: 'Mi Plan', icon: CreditCard },
  { to: '/peso', label: 'Control de Peso', icon: TrendingUp },
  { to: '/explorar', label: 'Explorar Áreas', icon: Dumbbell },
  { to: '/perfil', label: 'Mi Perfil', icon: User },
]

const staffDesktopNav = [
  { to: '/admin', label: 'Dashboard Admin', icon: LayoutDashboard, end: true },
  { to: '/admin/cobros', label: 'Cobros POS', icon: CreditCard },
  { to: '/admin/planes', label: 'Planes', icon: Layers },
  { to: '/admin/sesiones', label: 'Sesiones', icon: CalendarClock },
  { to: '/check-in', label: 'Escanear Check-In', icon: QrCode },
  { to: '/agenda', label: 'Agenda General', icon: CalendarDays },
  { to: '/explorar', label: 'Sesiones & Áreas', icon: Dumbbell },
  { to: '/peso', label: 'Control de Peso', icon: TrendingUp },
  { to: '/admin/marca', label: 'Marca & Config', icon: Settings },
  { to: '/perfil', label: 'Mi Perfil', icon: User },
]

// 5 tabs for Mobile
const memberMobileTabs = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/reservas', label: 'Reservas', icon: TicketCheck },
  { to: '/membresia', label: 'Mi Plan', icon: CreditCard },
  { to: '/peso', label: 'Peso', icon: TrendingUp },
]

const memberMobileTabsNoPlan = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/explorar', label: 'Explorar', icon: Dumbbell },
  { to: '/membresia', label: 'Mi Plan', icon: CreditCard },
  { to: '/peso', label: 'Peso', icon: TrendingUp },
]

const staffMobileTabs = [
  { to: '/admin', label: 'Admin', icon: LayoutDashboard, end: true },
  { to: '/admin/cobros', label: 'Cobros', icon: CreditCard },
  { to: '/check-in', label: 'Check-In', icon: QrCode },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/peso', label: 'Peso', icon: TrendingUp },
]

export function AppLayout() {
  const user = useCurrentUser()
  const repo = useRepo()
  const refresh = useRefresh()
  const { state, loading } = useGym()
  const { settings, bookings } = useAppData()
  const [noPlanReminderDismissed, setNoPlanReminderDismissed] = useState(
    wasNoPlanReminderDismissed,
  )

  const isMember = user?.role === 'member'
  const membership =
    user && state ? selectMyMembership(state, user.id) : undefined
  const showBookingNav = canUseBookingNav(user?.role, membership)
  const showNoPlanReminder =
    !loading &&
    Boolean(state) &&
    isMember &&
    !membership &&
    !noPlanReminderDismissed
  const desktopNav = (isMember ? memberDesktopNav : staffDesktopNav).filter(
    (item) =>
      showBookingNav || (item.to !== '/agenda' && item.to !== '/reservas'),
  )
  const mobileTabs = isMember
    ? showBookingNav
      ? memberMobileTabs
      : memberMobileTabsNoPlan
    : staffMobileTabs
  const accent = settings.accentColor || '#F26D17'

  const activeBookingsCount = isMember && user
    ? bookings.filter(
        (b) =>
          b.userId === user.id &&
          (b.status === 'confirmed' || b.status === 'waitlisted'),
      ).length
    : 0

  const userInitials = displayInitials(user?.fullName) || 'ZC'

  return (
    <div
      className="mx-auto flex h-dvh min-h-0 max-w-7xl flex-col overflow-hidden bg-bg text-ink lg:flex-row"
      style={{ ['--color-acc' as string]: accent }}
    >
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-line bg-surface p-5 lg:flex lg:max-h-dvh lg:flex-col lg:justify-between">
        <div className="space-y-6">
          {/* Brand Header */}
          <Link
            to={isMember ? '/' : '/admin'}
            className="flex items-center gap-3 px-2 py-1 transition hover:opacity-90"
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.name}
                className="h-10 w-10 rounded-xl object-cover shadow-md"
              />
            ) : (
              <img
                src={`${import.meta.env.BASE_URL}brand/mark-color.png`}
                alt={settings.name || 'Zona Cero'}
                className="h-6 w-auto shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-base font-black tracking-tight text-ink">
                {settings.name || 'Zona Cero'}
              </div>
              {!(settings.name || '').toLowerCase().includes('performance center') ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-acc">
                  <Sparkles className="h-3 w-3" />
                  <span>Performance Center</span>
                </div>
              ) : null}
            </div>
          </Link>

          {/* Nav List */}
          <nav className="flex flex-col gap-1.5">
            {desktopNav.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end !== undefined ? end : (to === '/' || to === '/admin')}
                className={({ isActive }) =>
                  `group flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-acc/15 text-acc border-l-3 border-acc font-bold shadow-sm'
                      : 'text-ink-2 hover:bg-surface-elevated hover:text-ink'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
                  <span>{label}</span>
                </div>
                {to === '/reservas' && activeBookingsCount > 0 ? (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-acc px-1.5 text-[10px] font-extrabold text-[var(--color-acc-contrast)]">
                    {activeBookingsCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="space-y-3 pt-4 border-t border-line">
          <Link
            to="/perfil"
            className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-surface-elevated"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated border border-line text-xs font-black text-acc">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-ink">
                {user?.fullName || 'Usuario'}
              </p>
              <p className="text-[11px] font-medium text-ink-3 capitalize">
                {user?.role === 'member'
                  ? 'Socio Activo'
                  : user?.role === 'staff'
                    ? 'Staff'
                    : 'Administrador'}
              </p>
            </div>
          </Link>

          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-medium text-ink-3 hover:text-danger"
            onClick={() => {
              void (async () => {
                await repo.signOut()
                await refresh()
              })()
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile Safe Area Top Header */}
        <header
          className="z-20 flex shrink-0 items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-md lg:hidden"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
        >
          <Link
            to={isMember ? '/' : '/admin'}
            className="flex items-center gap-2.5"
          >
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.name}
                className="h-8 w-8 rounded-lg object-cover"
              />
            ) : (
              <img
                src={`${import.meta.env.BASE_URL}brand/mark-color.png`}
                alt={settings.name || 'Zona Cero'}
                className="h-5 w-auto shrink-0"
              />
            )}
            <div>
              <span className="font-display text-sm font-black tracking-tight text-ink">
                {settings.name || 'Zona Cero'}
              </span>
              {!(settings.name || '').toLowerCase().includes('performance center') ? (
                <span className="block text-[10px] font-bold text-acc leading-none">
                  Performance Center
                </span>
              ) : null}
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/perfil"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-elevated text-xs font-bold text-acc transition active:scale-95"
              aria-label="Mi Perfil"
            >
              {userInitials}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 text-xs text-ink-3"
              onClick={() => {
                void (async () => {
                  await repo.signOut()
                  await refresh()
                })()
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Main scroll area — height is viewport minus header + tab bar (flex, not fixed overlay) */}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 sm:p-6 lg:p-8">
          <ExpiryBanner />
          <Outlet />
        </main>

        {showNoPlanReminder ? (
          <PlanRequiredNotice
            onDismiss={() => {
              markNoPlanReminderDismissed()
              setNoPlanReminderDismissed(true)
            }}
          />
        ) : null}

        {/* Mobile bottom tab bar — in document flow so content is never hidden underneath */}
        <nav
          className="z-30 shrink-0 border-t border-line bg-surface/95 backdrop-blur-lg shadow-2xl lg:hidden"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <div className="mx-auto flex max-w-md items-center justify-around px-2 pt-2">
            {mobileTabs.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end !== undefined ? end : (to === '/' || to === '/admin')}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-bold transition-all duration-200 active:scale-95 ${
                    isActive ? 'text-acc' : 'text-ink-3 hover:text-ink-2'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon
                        className={`h-5 w-5 transition-transform duration-200 ${
                          isActive ? 'scale-110' : ''
                        }`}
                      />
                      {to === '/reservas' && activeBookingsCount > 0 ? (
                        <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-acc px-1 text-[9px] font-extrabold text-[var(--color-acc-contrast)]">
                          {activeBookingsCount}
                        </span>
                      ) : null}
                    </div>
                    <span className="tracking-tight">{label}</span>
                    {isActive ? (
                      <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-acc" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
