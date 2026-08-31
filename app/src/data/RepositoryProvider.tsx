import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { GymState, User } from '@/domain/models'
import { getRepository } from '@/data/repository'
import { LocalRepository } from '@/data/localRepository'
import type { GymRepository } from '@/data/types'

type Ctx = {
  repo: GymRepository
  state: GymState | null
  user: User | null
  refresh: () => Promise<void>
  loading: boolean
}

const GymContext = createContext<Ctx | null>(null)

const EMPTY_STATE: GymState = {
  settings: {
    name: 'Zona Cero',
    logoUrl: null,
    primaryColor: '#0E1117',
    accentColor: '#FF6146',
    bookingWindowHours: 72,
    cancelWindowHours: 2,
    checkInWindowMinutes: 20,
  },
  users: [],
  trainers: [],
  zones: [],
  templates: [],
  sessions: [],
  bookings: [],
  waitlist: [],
  checkIns: [],
  measurements: [],
  bodyGoals: [],
  membershipPlans: [],
  memberships: [],
  payments: [],
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repo = getRepository()
  const [state, setState] = useState<GymState | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const [s, u] = await Promise.all([repo.load(), repo.getCurrentUser()])
    setState(s)
    setUser(u)
    setLoading(false)
  }, [repo])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <GymContext.Provider value={{ repo, state, user, refresh, loading }}>
      {children}
    </GymContext.Provider>
  )
}

export function useGym() {
  const ctx = useContext(GymContext)
  if (!ctx) throw new Error('RepositoryProvider missing')
  return ctx
}

export function useRepo() {
  return useGym().repo
}

export function useAppData(): GymState {
  return useGym().state ?? EMPTY_STATE
}

export function useCurrentUser() {
  return useGym().user
}

export function useRefresh() {
  return useGym().refresh
}

export function useLocalRepo(): LocalRepository | null {
  const repo = useGym().repo
  return repo instanceof LocalRepository ? repo : null
}
