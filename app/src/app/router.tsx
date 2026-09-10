import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
import { NotFoundPage } from './NotFoundPage'
import { useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { Spinner } from '@/ui/primitives'

// Carga diferida por ruta: cada página entra en su propio chunk y solo se
// descarga cuando el usuario navega a ella.
const LoginPage = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/ResetPasswordPage').then((m) => ({
    default: m.ResetPasswordPage,
  })),
)
const HomePage = lazy(() =>
  import('@/features/catalog/HomePage').then((m) => ({ default: m.HomePage })),
)
const ExplorePage = lazy(() =>
  import('@/features/catalog/ExplorePage').then((m) => ({
    default: m.ExplorePage,
  })),
)
const AgendaPage = lazy(() =>
  import('@/features/agenda/AgendaPage').then((m) => ({ default: m.AgendaPage })),
)
const MyBookingsPage = lazy(() =>
  import('@/features/bookings/MyBookingsPage').then((m) => ({
    default: m.MyBookingsPage,
  })),
)
const CheckInPage = lazy(() =>
  import('@/features/bookings/CheckInPage').then((m) => ({
    default: m.CheckInPage,
  })),
)
const WeightPage = lazy(() =>
  import('@/features/weight/WeightPage').then((m) => ({ default: m.WeightPage })),
)
const AdminPage = lazy(() =>
  import('@/features/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
)
const BrandingPage = lazy(() =>
  import('@/features/admin/BrandingPage').then((m) => ({
    default: m.BrandingPage,
  })),
)
const CobrosPage = lazy(() =>
  import('@/features/admin/CobrosPage').then((m) => ({ default: m.CobrosPage })),
)
const PlanesPage = lazy(() =>
  import('@/features/admin/PlanesPage').then((m) => ({ default: m.PlanesPage })),
)
const SessionsPage = lazy(() =>
  import('@/features/admin/SessionsPage').then((m) => ({
    default: m.SessionsPage,
  })),
)
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({
    default: m.ProfilePage,
  })),
)
const MiPlanPage = lazy(() =>
  import('@/features/memberships/MiPlanPage').then((m) => ({
    default: m.MiPlanPage,
  })),
)

function RootRedirect() {
  const user = useCurrentUser()
  const { loading } = useGym()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'member' ? '/' : '/admin'} replace />
}

export function AppRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {/* Pública: se llega desde el enlace del correo, sin sesión iniciada. */}
        <Route path="/recuperar" element={<ResetPasswordPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="membresia" element={<MiPlanPage />} />
            <Route path="explorar" element={<ExplorePage />} />
            <Route path="catalogo" element={<ExplorePage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="reservas" element={<MyBookingsPage />} />
            <Route path="check-in" element={<CheckInPage />} />
            <Route path="peso" element={<WeightPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="admin/cobros" element={<CobrosPage />} />
            <Route path="admin/planes" element={<PlanesPage />} />
            <Route path="admin/sesiones" element={<SessionsPage />} />
            <Route path="admin/marca" element={<BrandingPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Suspense>
  )
}
