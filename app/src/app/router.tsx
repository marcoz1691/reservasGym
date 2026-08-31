import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
import { LoginPage } from '@/features/auth/LoginPage'
import { HomePage } from '@/features/catalog/HomePage'
import { ExplorePage } from '@/features/catalog/ExplorePage'
import { AgendaPage } from '@/features/agenda/AgendaPage'
import { MyBookingsPage } from '@/features/bookings/MyBookingsPage'
import { CheckInPage } from '@/features/bookings/CheckInPage'
import { WeightPage } from '@/features/weight/WeightPage'
import { AdminPage } from '@/features/admin/AdminPage'
import { BrandingPage } from '@/features/admin/BrandingPage'
import { CobrosPage } from '@/features/admin/CobrosPage'
import { PlanesPage } from '@/features/admin/PlanesPage'
import { SessionsPage } from '@/features/admin/SessionsPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { MiPlanPage } from '@/features/memberships/MiPlanPage'
import { useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { Spinner } from '@/ui/primitives'

function RootRedirect() {
  const user = useCurrentUser()
  const { loading } = useGym()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'member' ? '/' : '/admin'} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        </Route>
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
