import { create } from 'zustand'
import type {
  BodyGoal,
  BodyMeasurement,
  Booking,
  GymSettings,
  GymState,
  ManualPaymentMethod,
  Membership,
  MembershipPlan,
  Payment,
  Session,
  User,
  Zone,
  ZoneType,
} from '@/domain/models'
import type { AuthCredentials } from '@/data/types'
import { getRepository } from '@/data'

type AgendaView = 'day' | 'week' | 'month'

type AppStore = {
  ready: boolean
  loading: boolean
  error: string | null
  user: User | null
  state: GymState | null
  zoneFilter: ZoneType | 'all'
  agendaView: AgendaView
  selectedDate: string
  init: () => Promise<void>
  refresh: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (creds: AuthCredentials | string, password?: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  deleteAccount: () => Promise<void>
  updateProfile: (patch: Partial<Omit<User, 'id' | 'email' | 'role' | 'createdAt'>>) => Promise<void>
  setZoneFilter: (z: ZoneType | 'all') => void
  setAgendaView: (v: AgendaView) => void
  setSelectedDate: (isoDate: string) => void
  book: (sessionId: string) => Promise<string>
  cancel: (bookingId: string) => Promise<void>
  reschedule: (bookingId: string, sessionId: string) => Promise<void>
  checkIn: (bookingId: string, code: string) => Promise<void>
  saveMeasurement: (input: Omit<BodyMeasurement, 'id'>) => Promise<void>
  updateMeasurement: (
    id: string,
    patch: Partial<Omit<BodyMeasurement, 'id' | 'userId' | 'recordedBy'>>,
  ) => Promise<void>
  removeMeasurement: (id: string) => Promise<void>
  saveBodyGoal: (goal: Omit<BodyGoal, 'id' | 'createdAt'> & { id?: string }) => Promise<void>
  deleteBodyGoal: (id: string) => Promise<void>
  saveSettings: (patch: Partial<GymSettings>) => Promise<void>
  upsertZone: (zone: Zone) => Promise<void>
  upsertSession: (session: Session) => Promise<void>
  deleteSession: (id: string) => Promise<void>
  registerManualPayment: (params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }) => Promise<{ payment: Payment; membership: Membership }>
  upsertMembershipPlan: (
    plan: Partial<MembershipPlan> & { name: string; priceCents: number; durationDays: number },
  ) => Promise<void>
  deleteMembershipPlan: (planId: string) => Promise<void>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  loading: false,
  error: null,
  user: null,
  state: null,
  zoneFilter: 'all',
  agendaView: 'week',
  selectedDate: todayIso(),

  init: async () => {
    const repo = getRepository()
    const [user, state] = await Promise.all([repo.getCurrentUser(), repo.load()])
    set({ user, state, ready: true })
  },

  refresh: async () => {
    const repo = getRepository()
    const [state, user] = await Promise.all([repo.load(), repo.getCurrentUser()])
    set({ state, user })
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const user = await getRepository().signIn({ email, password })
      const state = await getRepository().load()
      set({ user, state, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Error al iniciar sesión',
      })
      throw e
    }
  },

  signUp: async (credsOrEmail, maybePassword, maybeFullName) => {
    set({ loading: true, error: null })
    try {
      const creds: AuthCredentials =
        typeof credsOrEmail === 'string'
          ? {
              email: credsOrEmail,
              password: maybePassword ?? '',
              fullName: maybeFullName ?? '',
            }
          : credsOrEmail
      const user = await getRepository().signUp(creds)
      const state = await getRepository().load()
      set({ user, state, loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Error al registrarse',
      })
      throw e
    }
  },

  signOut: async () => {
    await getRepository().signOut()
    set({ user: null })
  },

  resetPassword: async (email: string) => {
    set({ loading: true, error: null })
    try {
      await getRepository().resetPassword(email)
      set({ loading: false })
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Error al recuperar contraseña',
      })
      throw e
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null })
    try {
      await getRepository().deleteAccount()
      set({ user: null, loading: false })
      await get().refresh()
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : 'Error al eliminar cuenta',
      })
      throw e
    }
  },

  updateProfile: async (patch) => {
    const repo = getRepository()
    if (repo.updateProfile) {
      const user = await repo.updateProfile(patch)
      set({ user })
      await get().refresh()
    }
  },

  setZoneFilter: (zoneFilter) => set({ zoneFilter }),
  setAgendaView: (agendaView) => set({ agendaView }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),

  book: async (sessionId) => {
    const user = get().user
    if (!user) throw new Error('Inicia sesión')
    const result = await getRepository().createBooking(sessionId, user.id)
    await get().refresh()
    return 'position' in result
      ? `Lista de espera #${result.position}`
      : 'Reserva confirmada'
  },

  cancel: async (bookingId) => {
    await getRepository().cancelBooking(bookingId)
    await get().refresh()
  },

  reschedule: async (bookingId, sessionId) => {
    await getRepository().rescheduleBooking(bookingId, sessionId)
    await get().refresh()
  },

  checkIn: async (bookingId, code) => {
    await getRepository().checkIn(bookingId, code)
    await get().refresh()
  },

  saveMeasurement: async (input) => {
    await getRepository().createMeasurement(input)
    await get().refresh()
  },

  updateMeasurement: async (id, patch) => {
    await getRepository().updateMeasurement(id, patch)
    await get().refresh()
  },

  removeMeasurement: async (id) => {
    await getRepository().deleteMeasurement(id)
    await get().refresh()
  },

  saveBodyGoal: async (goal) => {
    await getRepository().upsertBodyGoal(goal)
    await get().refresh()
  },

  deleteBodyGoal: async (id) => {
    const repo = getRepository()
    if (repo.deleteBodyGoal) {
      await repo.deleteBodyGoal(id)
    }
    await get().refresh()
  },

  saveSettings: async (patch) => {
    await getRepository().updateSettings(patch)
    await get().refresh()
  },

  upsertZone: async (zone) => {
    await getRepository().upsertZone(zone)
    await get().refresh()
  },

  upsertSession: async (session) => {
    await getRepository().upsertSession(session)
    await get().refresh()
  },

  deleteSession: async (id) => {
    await getRepository().deleteSession(id)
    await get().refresh()
  },

  registerManualPayment: async (params) => {
    const res = await getRepository().registerManualPayment(params)
    await get().refresh()
    return res
  },

  upsertMembershipPlan: async (plan) => {
    await getRepository().upsertMembershipPlan(plan)
    await get().refresh()
  },

  deleteMembershipPlan: async (planId) => {
    await getRepository().deleteMembershipPlan(planId)
    await get().refresh()
  },
}))

export function selectMyBookings(state: GymState | null, userId?: string): Booking[] {
  if (!state || !userId) return []
  return state.bookings.filter((b) => b.userId === userId)
}

export function selectMyMembership(state: GymState | null, userId?: string): Membership | null {
  if (!state || !userId) return null
  const userMemberships = (state.memberships ?? []).filter((m) => m.userId === userId)
  if (userMemberships.length === 0) return null
  return userMemberships[0] ?? null
}

export function selectMyPayments(state: GymState | null, userId?: string): Payment[] {
  if (!state || !userId) return []
  return (state.payments ?? []).filter((p) => p.userId === userId)
}
