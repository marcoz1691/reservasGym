import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser, useGym } from '@/data/RepositoryProvider'
import { Spinner } from '@/ui/primitives'

export function RequireAuth() {
  const user = useCurrentUser()
  const { loading } = useGym()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
