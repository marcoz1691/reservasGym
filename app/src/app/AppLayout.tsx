import { useState, useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import {
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
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import { ExpiryBanner } from '@/features/memberships'
import { FichaTecnicaModal } from '@/features/profile/FichaTecnicaModal'
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
  const { settings, bookings } = useAppData()

  const [fichaModalOpen, setFichaModalOpen] = useState(false)
  const [isInitialOnboarding, setIsInitialOnboarding] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && user?.role === 'member') {
      const justSignedUp = sessionStorage.getItem('just_signed_up') === 'true'
      if (justSignedUp) {
        sessionStorage.removeItem('just_signed_up')
        setIsInitialOnboarding(true)
        setFichaModalOpen(true)
      }
    }
  }, [user])

  const isMember = user?.role === 'member'
  const desktopNav = isMember ? memberDesktopNav : staffDesktopNav
  const mobileTabs = isMember ? memberMobileTabs : staffMobileTabs
  const accent = settings.accentColor || '#FF6146'

  const activeBookingsCount = isMember && user
    ? bookings.filter(
        (b) =>
          b.userId === user.id &&
          (b.status === 'confirmed' || b.status === 'waitlisted'),
      ).length
    : 0

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ZC'

  return (
    <div
      className="mx-auto flex min-h-dvh max-w-7xl flex-col bg-bg text-ink lg:flex-row"
      style={{ ['--color-acc' as string]: accent }}
    >
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface p-5 lg:flex lg:flex-col justify-between">
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acc text-white shadow-lg shadow-acc/25 font-black">
                <Dumbbell className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate font-display text-base font-black tracking-tight text-ink">
                {settings.name || 'Zona Cero'}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-acc">
                <Sparkles className="h-3 w-3" />
                <span>Performance Center</span>
              </div>
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
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-acc px-1.5 text-[10px] font-extrabold text-white">
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Safe Area Top Header */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-md lg:hidden"
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-acc text-white font-black shadow-sm">
                <Dumbbell className="h-4 w-4" />
              </div>
            )}
            <div>
              <span className="font-display text-sm font-black tracking-tight text-ink">
                {settings.name || 'Zona Cero'}
              </span>
              <span className="block text-[10px] font-bold text-acc leading-none">
                Performance Center
              </span>
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

        {/* Main Content with Safe Bottom Margin for Tab Bar */}
        <main className="flex-1 p-4 pb-28 sm:p-6 lg:p-8 lg:pb-8">
          <ExpiryBanner />
          <Outlet />
        </main>

        {/* Mobile Safe Area Bottom Tab Bar (5 Tabs) */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg shadow-2xl lg:hidden"
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
                        <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-acc px-1 text-[9px] font-extrabold text-white">
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

      <FichaTecnicaModal
        open={fichaModalOpen}
        onClose={() => setFichaModalOpen(false)}
        isInitialOnboarding={isInitialOnboarding}
      />
    </div>
  )
}
