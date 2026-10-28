import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  QueryClientProvider,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { GymState, User } from '@/domain/models'
import { getRepository } from '@/data/repository'
import { LocalRepository } from '@/data/localRepository'
import type { GymRepository } from '@/data/types'
import { gymStateQueryOptions } from '@/data/gymQueries'
import { queryKeys } from '@/data/queryKeys'
import { createQueryClient, installNativeFocusRefetch } from '@/data/queryClient'

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
    primaryColor: '#231F20',
    accentColor: '#F26D17',
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

/**
 * Cada provider crea su QueryClient (en la app hay uno solo; en los tests,
 * uno por render, así la caché no se cruza entre casos).
 */
export function RepositoryProvider({
  children,
  queryClient,
}: {
  children: ReactNode
  queryClient?: QueryClient
}) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  useEffect(() => {
    void installNativeFocusRefetch()
  }, [])
  return (
    <QueryClientProvider client={client}>
      <GymStateProvider>{children}</GymStateProvider>
    </QueryClientProvider>
  )
}

function GymStateProvider({ children }: { children: ReactNode }) {
  const repo = getRepository()
  const queryClient = useQueryClient()
  const query = useQuery(gymStateQueryOptions(repo, queryClient))
  // `loading` sigue el contrato de antes (carga inicial o refresh() manual);
  // los refrescos en segundo plano de la caché no muestran esqueletos.
  const [manualRefreshes, setManualRefreshes] = useState(0)

  const refresh = useCallback(async () => {
    setManualRefreshes((n) => n + 1)
    try {
      await queryClient.refetchQueries({ queryKey: queryKeys.gymState() })
    } finally {
      setManualRefreshes((n) => n - 1)
    }
  }, [queryClient])

  const value: Ctx = {
    repo,
    state: query.data?.state ?? null,
    user: query.data?.user ?? null,
    refresh,
    loading: query.isPending || manualRefreshes > 0,
  }

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>
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

/**
 * Estado del gimnasio leído desde la caché de TanStack Query. A diferencia de
 * `useAppData()`, la pantalla se suscribe a la consulta: al montarse con datos
 * vencidos (más de 30 s) los refresca en segundo plano.
 */
export function useGymStateQuery(): {
  data: GymState
  user: User | null
  isPending: boolean
} {
  const repo = useRepo()
  const queryClient = useQueryClient()
  const query = useQuery(gymStateQueryOptions(repo, queryClient))
  return {
    data: query.data?.state ?? EMPTY_STATE,
    user: query.data?.user ?? null,
    isPending: query.isPending,
  }
}

/** Marca vencido el estado del gimnasio y espera a que se vuelva a cargar. */
export function useInvalidateGymState(): () => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.gymState() }),
    [queryClient],
  )
}

export function useLocalRepo(): LocalRepository | null {
  const repo = useGym().repo
  return repo instanceof LocalRepository ? repo : null
}
