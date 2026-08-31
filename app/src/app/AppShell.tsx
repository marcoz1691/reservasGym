import { NavLink, Outlet, Link } from 'react-router-dom'
import {
  CalendarDays,
  CreditCard,
  Dumbbell,
  Home,
  LayoutDashboard,
  LogOut,
  QrCode,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useEffect } from 'react'
import { useAppStore } from './store'
import { applyBrandColors } from '@/lib/format'

const memberLinks = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/reservas', label: 'Reservas', icon: Dumbbell },
  { to: '/membresia', label: 'Mi Plan', icon: CreditCard },
  { to: '/peso', label: 'Peso', icon: TrendingUp },
]

const staffLinks = [
  { to: '/admin', label: 'Admin', icon: LayoutDashboard, end: true },
  { to: '/admin/cobros', label: 'Cobros', icon: CreditCard },
  { to: '/check-in', label: 'Check-in', icon: QrCode },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/peso', label: 'Peso', icon: TrendingUp },
]

export function AppShell() {
  const user = useAppStore((s) => s.user)
  const state = useAppStore((s) => s.state)
  const signOut = useAppStore((s) => s.signOut)
  const isStaff = user?.role === 'staff' || user?.role === 'admin'
  const links = isStaff ? staffLinks : memberLinks
  const brandName = state?.settings?.name || 'Zona Cero'

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'ZC'

  useEffect(() => {
    if (state?.settings) {
      applyBrandColors(
        state.settings.primaryColor || '#0E1117',
        state.settings.accentColor || '#FF6146',
      )
    }
  }, [state?.settings])

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col bg-bg text-ink md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface p-5 md:flex md:flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acc text-white shadow-lg shadow-acc/25 font-black">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-black tracking-tight text-ink">
                {brandName}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-acc">
                <Sparkles className="h-3 w-3" />
                <span>Performance Center</span>
              </div>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-acc/15 text-acc border-l-3 border-acc font-bold shadow-sm'
                      : 'text-ink-2 hover:bg-surface-elevated hover:text-ink'
                  }`
                }
              >
                <l.icon size={18} />
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

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
                {user?.role === 'member' ? 'Socio' : 'Staff'}
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-3 hover:text-danger transition"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Header with Safe Area */}
        <header
          className="sticky top-0 z-20 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur-md md:hidden"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-acc text-white font-black shadow-sm">
                <Dumbbell className="h-4 w-4" />
              </div>
              <p className="font-display text-sm font-black text-ink">{brandName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/perfil"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface-elevated text-xs font-bold text-acc"
              >
                {userInitials}
              </Link>
              <button
                type="button"
                className="text-xs font-semibold text-ink-3 hover:text-ink"
                onClick={() => void signOut()}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-5 pb-28 sm:px-6 md:px-8 md:py-7 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation (5 Tabs with Safe Area) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-lg shadow-2xl md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      >
        <div className="mx-auto flex max-w-md justify-around px-2 pt-2">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl py-1 text-[11px] font-bold transition-all ${
                  isActive ? 'text-acc' : 'text-ink-3 hover:text-ink-2'
                }`
              }
            >
              <l.icon size={18} />
              <span className="truncate">{l.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
