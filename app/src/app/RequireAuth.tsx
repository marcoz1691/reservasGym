import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { selectMyDayPasses, selectMyMembership } from '@/app/store'
import { canUseBookingNav, isFichaPending } from '@/domain/rules'
import { wasFichaSkipped } from '@/features/profile/fichaOnboarding'
import { Spinner } from '@/ui/primitives'

export function RequireAuth() {
  const user = useCurrentUser()
  const { loading, state } = useGym()
  const location = useLocation()
  if (loading && !user) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  // Primer ingreso del socio: la ficha técnica va antes de entrar a la app.
  if (
    isFichaPending(user) &&
    !wasFichaSkipped() &&
    location.pathname !== '/bienvenida'
  ) {
    return <Navigate to="/bienvenida" replace />
  }
  if (location.pathname === '/bienvenida' && !isFichaPending(user)) {
    return <Navigate to="/" replace />
  }
  const membership = state ? selectMyMembership(state, user.id) : undefined
  const hasDayPass = selectMyDayPasses(state, user.id).length > 0
  if (
    !canUseBookingNav(user.role, membership, hasDayPass) &&
    (location.pathname === '/agenda' || location.pathname === '/reservas')
  ) {
    return <Navigate to="/membresia" replace />
  }
  return <Outlet />
}
