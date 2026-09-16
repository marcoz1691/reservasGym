import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  BodyGoal,
  BodyGoalStatus,
  BodyMeasurement,
  Booking,
  BookingStatus,
  CheckIn,
  ClassTemplate,
  GymSettings,
  GymState,
  ManualPaymentMethod,
  Membership,
  MembershipPlan,
  MembershipStatus,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Session,
  SessionKind,
  Trainer,
  User,
  UserRole,
  WaitlistEntry,
  Zone,
  ZoneType,
} from '@/domain/models'
import {
  calculateBmi,
  canBookSession,
  canManageGoals,
  canManageWeight,
  computeMembershipStatus,
  extendMembership,
  hasOverlap,
  isCheckInWindow,
  nextWaitlistPosition,
  promoteFirstWaitlist,
} from '@/domain/rules'
import type { AuthCredentials, GymRepository } from './types'
import { isSupabaseEnvConfigured } from './selectRepositoryBackend'
import { scopeGymState } from './scopeGymState'

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function mapUser(row: {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  birth_date?: string | null
  residence?: string | null
  height_cm?: number | string | null
  initial_weight_kg?: number | string | null
  goals?: string | null
  health_notes?: string | null
  dolencias?: string | null
}): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as UserRole,
    createdAt: row.created_at,
    birthDate: row.birth_date ?? undefined,
    residence: row.residence ?? undefined,
    heightCm: row.height_cm != null ? Number(row.height_cm) : undefined,
    initialWeightKg:
      row.initial_weight_kg != null ? Number(row.initial_weight_kg) : undefined,
    goals: row.goals ?? undefined,
    healthNotes: row.health_notes ?? row.dolencias ?? undefined,
  }
}

function mapSettings(row: {
  name: string
  logo_url: string | null
  primary_color: string
  accent_color: string
  booking_window_hours: number
  cancel_window_hours: number
  check_in_window_minutes: number
}): GymSettings {
  return {
    name: row.name,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    accentColor: row.accent_color,
    bookingWindowHours: row.booking_window_hours,
    cancelWindowHours: row.cancel_window_hours,
    checkInWindowMinutes: row.check_in_window_minutes,
  }
}

function mapZone(row: {
  id: string
  name: string
  type: string
  description: string | null
  default_capacity: number
  image_hint: string | null
}): Zone {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ZoneType,
    description: row.description ?? '',
    defaultCapacity: row.default_capacity,
    imageHint: row.image_hint ?? '',
  }
}

function mapTrainer(row: {
  id: string
  full_name: string
  specialties: string[]
}): Trainer {
  return {
    id: row.id,
    fullName: row.full_name,
    specialties: row.specialties as ZoneType[],
  }
}

function mapTemplate(row: {
  id: string
  zone_id: string
  title: string
  kind: string
  duration_minutes: number
  capacity: number
  trainer_id: string | null
}): ClassTemplate {
  return {
    id: row.id,
    zoneId: row.zone_id,
    title: row.title,
    kind: row.kind as SessionKind,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    trainerId: row.trainer_id,
  }
}

function mapSession(row: {
  id: string
  template_id: string
  zone_id: string
  title: string
  kind: string
  starts_at: string
  ends_at: string
  capacity: number
  trainer_id: string | null
  booked_count: number
}): Session {
  return {
    id: row.id,
    templateId: row.template_id,
    zoneId: row.zone_id,
    title: row.title,
    kind: row.kind as SessionKind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    trainerId: row.trainer_id,
    bookedCount: row.booked_count,
  }
}

function mapBooking(row: {
  id: string
  session_id: string
  user_id: string
  status: string
  created_at: string
  cancelled_at: string | null
  check_in_code: string
}): Booking {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    status: row.status as BookingStatus,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    checkInCode: row.check_in_code,
  }
}

function mapWaitlist(row: {
  id: string
  session_id: string
  user_id: string
  position: number
  created_at: string
}): WaitlistEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    position: row.position,
    createdAt: row.created_at,
  }
}

function mapCheckIn(row: {
  id: string
  booking_id: string
  session_id: string
  user_id: string
  checked_in_at: string
}): CheckIn {
  return {
    id: row.id,
    bookingId: row.booking_id,
    sessionId: row.session_id,
    userId: row.user_id,
    checkedInAt: row.checked_in_at,
  }
}

function mapMeasurement(row: {
  id: string
  user_id: string
  recorded_by: string
  weight_kg: number | string
  height_cm?: number | string | null
  bmi?: number | string | null
  waist_cm?: number | string | null
  hip_cm?: number | string | null
  chest_cm?: number | string | null
  arm_cm?: number | string | null
  thigh_cm?: number | string | null
  measured_at: string
  notes: string | null
}): BodyMeasurement {
  return {
    id: row.id,
    userId: row.user_id,
    recordedBy: row.recorded_by,
    weightKg: Number(row.weight_kg),
    heightCm: row.height_cm != null ? Number(row.height_cm) : undefined,
    bmi: row.bmi != null ? Number(row.bmi) : undefined,
    waistCm: row.waist_cm != null ? Number(row.waist_cm) : undefined,
    hipCm: row.hip_cm != null ? Number(row.hip_cm) : undefined,
    chestCm: row.chest_cm != null ? Number(row.chest_cm) : undefined,
    armCm: row.arm_cm != null ? Number(row.arm_cm) : undefined,
    thighCm: row.thigh_cm != null ? Number(row.thigh_cm) : undefined,
    measuredAt: row.measured_at,
    notes: row.notes ?? '',
  }
}

function mapBodyGoal(row: {
  id: string
  user_id: string
  target_weight_kg: number | string
  target_bmi?: number | string | null
  target_date: string
  status: string
  created_at?: string
}): BodyGoal {
  return {
    id: row.id,
    userId: row.user_id,
    targetWeightKg: Number(row.target_weight_kg),
    targetBmi: row.target_bmi != null ? Number(row.target_bmi) : undefined,
    targetDate: row.target_date,
    status: (row.status as BodyGoalStatus) || 'active',
    createdAt: row.created_at,
  }
}

function mapMembershipPlan(row: {
  id: string
  name: string
  price_cents: number
  duration_days: number
  visit_quota: number | null
  allowed_zone_ids: string[] | null
  active: boolean
  created_at?: string
}): MembershipPlan {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    durationDays: row.duration_days,
    visitQuota: row.visit_quota,
    allowedZoneIds: row.allowed_zone_ids ?? [],
    active: row.active,
    createdAt: row.created_at,
  }
}

function mapMembership(row: {
  id: string
  user_id: string
  plan_id: string
  status: string
  starts_at: string
  ends_at: string
  visits_left: number | null
  grace_ends_at: string | null
  created_at?: string
}): Membership {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status as MembershipStatus,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    visitsLeft: row.visits_left,
    graceEndsAt: row.grace_ends_at,
    createdAt: row.created_at,
  }
}

function mapPayment(row: {
  id: string
  user_id: string
  plan_id: string
  membership_id: string | null
  amount_cents: number
  status: string
  provider: string
  manual_method: string | null
  reference?: string | null
  created_at: string
  approved_at: string | null
}): Payment {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    membershipId: row.membership_id,
    amountCents: row.amount_cents,
    status: row.status as PaymentStatus,
    provider: row.provider as PaymentProvider,
    manualMethod: (row.manual_method as ManualPaymentMethod) ?? null,
    reference: row.reference,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  }
}

export function isSupabaseConfigured(): boolean {
  return isSupabaseEnvConfigured({
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  })
}

export function createSupabaseClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim()
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    throw new Error('Supabase no está configurado')
  }
  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Canjea el token del enlace de recuperación (viene en el hash de la
      // URL) por una sesión al cargar /recuperar. Es el default de
      // supabase-js, pero se deja explícito porque ZCAPP-46 depende de esto.
      detectSessionInUrl: true,
    },
  })
}

export class SupabaseRepository implements GymRepository {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient = createSupabaseClient()) {
    this.client = client
  }

  private async requireUser(): Promise<User> {
    const user = await this.getCurrentUser()
    if (!user) throw new Error('No hay sesión activa')
    return user
  }

  private async requireStaff(): Promise<User> {
    const user = await this.requireUser()
    if (user.role === 'member') throw new Error('Sin permiso')
    return user
  }

  private async requireAdmin(): Promise<User> {
    const user = await this.requireUser()
    if (user.role !== 'admin') throw new Error('Solo admin')
    return user
  }

  private async fetchState(): Promise<GymState> {
    const [
      settingsRes,
      profilesRes,
      trainersRes,
      zonesRes,
      templatesRes,
      sessionsRes,
      bookingsRes,
      waitlistRes,
      checkInsRes,
      measurementsRes,
      bodyGoalsRes,
      membershipPlansRes,
      membershipsRes,
      paymentsRes,
    ] = await Promise.all([
      this.client.from('gym_settings').select('*').eq('id', 1).maybeSingle(),
      this.client.from('profiles').select('*'),
      this.client.from('trainers').select('*'),
      this.client.from('zones').select('*'),
      this.client.from('class_templates').select('*'),
      this.client.from('sessions').select('*'),
      this.client.from('bookings').select('*'),
      this.client.from('waitlist_entries').select('*'),
      this.client.from('check_ins').select('*'),
      this.client.from('body_measurements').select('*'),
      this.client.from('body_goals').select('*'),
      this.client.from('membership_plans').select('*'),
      this.client.from('memberships').select('*'),
      this.client.from('payments').select('*'),
    ])

    for (const res of [
      settingsRes,
      profilesRes,
      trainersRes,
      zonesRes,
      templatesRes,
      sessionsRes,
      bookingsRes,
      waitlistRes,
      checkInsRes,
      measurementsRes,
      bodyGoalsRes,
      membershipPlansRes,
      membershipsRes,
      paymentsRes,
    ]) {
      if (res.error) throw new Error(res.error.message)
    }

    const settingsRow = settingsRes.data
    if (!settingsRow) throw new Error('Faltan gym_settings en Supabase')

    return {
      settings: mapSettings(settingsRow),
      users: (profilesRes.data ?? []).map(mapUser),
      trainers: (trainersRes.data ?? []).map(mapTrainer),
      zones: (zonesRes.data ?? []).map(mapZone),
      templates: (templatesRes.data ?? []).map(mapTemplate),
      sessions: (sessionsRes.data ?? []).map(mapSession),
      bookings: (bookingsRes.data ?? []).map(mapBooking),
      waitlist: (waitlistRes.data ?? []).map(mapWaitlist),
      checkIns: (checkInsRes.data ?? []).map(mapCheckIn),
      measurements: (measurementsRes.data ?? []).map(mapMeasurement),
      bodyGoals: (bodyGoalsRes.data ?? []).map(mapBodyGoal),
      membershipPlans: (membershipPlansRes.data ?? []).map(mapMembershipPlan),
      memberships: (membershipsRes.data ?? []).map(mapMembership),
      payments: (paymentsRes.data ?? []).map(mapPayment),
    }
  }

  async load(): Promise<GymState> {
    const actor = await this.getCurrentUser()
    if (!actor) {
      return this.loadGuestState()
    }
    const state = await this.fetchState()
    // Defense in depth: even if RLS misconfigured, do not ship peer PII to members.
    return scopeGymState(state, actor)
  }

  /** Pre-login bootstrap: no RLS-protected queries (avoids infinite spinner on /). */
  private loadGuestState(): GymState {
    return scopeGymState(
      {
        settings: {
          name: 'Zona Cero Performance Center',
          logoUrl: null,
          primaryColor: '#0B3D2E',
          accentColor: '#2DD4A8',
          bookingWindowHours: 168,
          cancelWindowHours: 2,
          checkInWindowMinutes: 15,
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
      },
      null,
    )
  }

  async getCurrentUser(): Promise<User | null> {
    const { data: sessionData, error: sessionError } =
      await this.client.auth.getSession()
    if (sessionError) {
      await this.client.auth.signOut()
      return null
    }
    const authUser = sessionData.session?.user
    if (!authUser) return null
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    return mapUser(data)
  }

  async signIn(creds: AuthCredentials): Promise<User> {
    const { error } = await this.client.auth.signInWithPassword({
      email: creds.email.trim(),
      password: creds.password,
    })
    if (error) throw new Error(error.message)
    const user = await this.getCurrentUser()
    if (!user) throw new Error('Perfil no encontrado')
    return user
  }

  async signUp(creds: AuthCredentials): Promise<User> {
    if (!creds.fullName?.trim()) throw new Error('Nombre requerido')
    if (!creds.password || creds.password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres')
    }
    const { data: authData, error } = await this.client.auth.signUp({
      email: creds.email.trim(),
      password: creds.password,
      options: {
        data: {
          full_name: creds.fullName.trim(),
          birth_date: creds.birthDate?.trim() || null,
          residence: creds.residence?.trim() || null,
          height_cm: creds.heightCm ? Number(creds.heightCm) : null,
          initial_weight_kg: creds.initialWeightKg
            ? Number(creds.initialWeightKg)
            : null,
          goals: creds.goals?.trim() || null,
          health_notes: creds.healthNotes?.trim() || null,
        },
      },
    })
    if (error) throw new Error(error.message)

    if (authData?.user) {
      await this.client.from('profiles').upsert({
        id: authData.user.id,
        email: creds.email.trim().toLowerCase(),
        full_name: creds.fullName.trim(),
        role: 'member',
        birth_date: creds.birthDate?.trim() || null,
        residence: creds.residence?.trim() || null,
        height_cm: creds.heightCm ? Number(creds.heightCm) : null,
        initial_weight_kg: creds.initialWeightKg
          ? Number(creds.initialWeightKg)
          : null,
        goals: creds.goals?.trim() || null,
        health_notes: creds.healthNotes?.trim() || null,
      })

      if (creds.initialWeightKg && Number(creds.initialWeightKg) > 0) {
        await this.client.from('body_measurements').insert({
          user_id: authData.user.id,
          recorded_by: authData.user.id,
          weight_kg: Number(creds.initialWeightKg),
          measured_at: new Date().toISOString(),
          notes: 'Registro inicial al crear cuenta',
        })
      }
    }

    const user = await this.getCurrentUser()
    if (!user) {
      throw new Error(
        'Cuenta creada. Revisa tu correo si el proyecto exige confirmación.',
      )
    }
    return user
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut()
    if (error) throw new Error(error.message)
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(
      email.trim(),
      {
        // Apunta a la pantalla donde el socio escribe la contraseña nueva.
        // Esta URL debe estar en Authentication → URL Configuration →
        // Redirect URLs del proyecto Supabase, o el enlace del correo falla.
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/recuperar`
            : undefined,
      },
    )
    if (error) throw new Error(error.message)
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    })
    if (error) throw new Error(error.message)
  }

  /**
   * Al abrir el enlace del correo, supabase-js canjea el token del hash
   * por una sesión (detectSessionInUrl). Si hay sesión al entrar a
   * /recuperar, el enlace era válido.
   */
  async hasRecoverySession(): Promise<boolean> {
    const { data } = await this.client.auth.getSession()
    return Boolean(data.session)
  }

  async deleteAccount(): Promise<void> {
    const actor = await this.requireUser()
    const userId = actor.id

    // Delete personal records
    await this.client.from('payments').delete().eq('user_id', userId)
    await this.client.from('memberships').delete().eq('user_id', userId)
    await this.client.from('body_measurements').delete().eq('user_id', userId)
    await this.client.from('check_ins').delete().eq('user_id', userId)
    await this.client.from('waitlist_entries').delete().eq('user_id', userId)
    await this.client.from('bookings').delete().eq('user_id', userId)
    await this.client.from('profiles').delete().eq('id', userId)

    await this.signOut()
  }

  async updateProfile(
    patch: Partial<Omit<User, 'id' | 'email' | 'role' | 'createdAt'>>,
  ): Promise<User> {
    const actor = await this.requireUser()
    const row: Record<string, unknown> = {}
    if (patch.fullName !== undefined) row.full_name = patch.fullName.trim()
    if (patch.birthDate !== undefined)
      row.birth_date = patch.birthDate.trim() || null
    if (patch.residence !== undefined)
      row.residence = patch.residence.trim() || null
    if (patch.heightCm !== undefined)
      row.height_cm = patch.heightCm ? Number(patch.heightCm) : null
    if (patch.initialWeightKg !== undefined) {
      row.initial_weight_kg = patch.initialWeightKg
        ? Number(patch.initialWeightKg)
        : null
    }
    if (patch.goals !== undefined) row.goals = patch.goals.trim() || null
    if (patch.healthNotes !== undefined)
      row.health_notes = patch.healthNotes.trim() || null

    const { data, error } = await this.client
      .from('profiles')
      .update(row)
      .eq('id', actor.id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapUser(data)
  }

  async updateSettings(patch: Partial<GymSettings>): Promise<GymSettings> {
    await this.requireUser()
    const row: Record<string, unknown> = {}
    if (patch.name !== undefined) row.name = patch.name
    if (patch.logoUrl !== undefined) row.logo_url = patch.logoUrl
    if (patch.primaryColor !== undefined) row.primary_color = patch.primaryColor
    if (patch.accentColor !== undefined) row.accent_color = patch.accentColor
    if (patch.bookingWindowHours !== undefined) {
      row.booking_window_hours = patch.bookingWindowHours
    }
    if (patch.cancelWindowHours !== undefined) {
      row.cancel_window_hours = patch.cancelWindowHours
    }
    if (patch.checkInWindowMinutes !== undefined) {
      row.check_in_window_minutes = patch.checkInWindowMinutes
    }
    const { data, error } = await this.client
      .from('gym_settings')
      .update(row)
      .eq('id', 1)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapSettings(data)
  }

  async listZones(): Promise<Zone[]> {
    const { data, error } = await this.client.from('zones').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapZone)
  }

  async upsertZone(zone: Zone): Promise<Zone> {
    await this.requireUser()
    const { data, error } = await this.client
      .from('zones')
      .upsert({
        id: zone.id,
        name: zone.name,
        type: zone.type,
        description: zone.description,
        default_capacity: zone.defaultCapacity,
        image_hint: zone.imageHint,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapZone(data)
  }

  async deleteZone(id: string): Promise<void> {
    await this.requireUser()
    const { error } = await this.client.from('zones').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listTemplates(): Promise<ClassTemplate[]> {
    const { data, error } = await this.client.from('class_templates').select('*')
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapTemplate)
  }

  async upsertTemplate(template: ClassTemplate): Promise<ClassTemplate> {
    await this.requireUser()
    const { data, error } = await this.client
      .from('class_templates')
      .upsert({
        id: template.id,
        zone_id: template.zoneId,
        title: template.title,
        kind: template.kind,
        duration_minutes: template.durationMinutes,
        capacity: template.capacity,
        trainer_id: template.trainerId,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapTemplate(data)
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.requireUser()
    const { error } = await this.client
      .from('class_templates')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listSessions(fromIso?: string, toIso?: string): Promise<Session[]> {
    let query = this.client.from('sessions').select('*')
    if (fromIso) query = query.gte('starts_at', fromIso)
    if (toIso) query = query.lte('starts_at', toIso)
    const { data, error } = await query.order('starts_at')
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapSession)
  }

  async upsertSession(session: Session): Promise<Session> {
    await this.requireUser()
    const { data, error } = await this.client
      .from('sessions')
      .upsert({
        id: session.id,
        template_id: session.templateId,
        zone_id: session.zoneId,
        title: session.title,
        kind: session.kind,
        starts_at: session.startsAt,
        ends_at: session.endsAt,
        capacity: session.capacity,
        trainer_id: session.trainerId,
        booked_count: session.bookedCount,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapSession(data)
  }

  async deleteSession(id: string): Promise<void> {
    await this.requireUser()
    const { error } = await this.client.from('sessions').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listBookingsForUser(userId: string): Promise<Booking[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapBooking)
  }

  async createBooking(
    sessionId: string,
    userId: string,
  ): Promise<Booking | WaitlistEntry> {
    const actor = await this.requireUser()
    if (actor.role === 'member' && actor.id !== userId) {
      throw new Error('No puedes reservar por otro socio')
    }
    const state = await this.fetchState()
    const session = state.sessions.find((s) => s.id === sessionId)
    if (!session) throw new Error('Sesión no encontrada')

    const already = state.bookings.find(
      (b) =>
        b.sessionId === sessionId &&
        b.userId === userId &&
        (b.status === 'confirmed' ||
          b.status === 'pending' ||
          b.status === 'waitlisted'),
    )
    if (already) throw new Error('Ya tienes reserva en esta sesión')
    if (hasOverlap(state.sessions, state.bookings, userId, session)) {
      throw new Error('Se solapa con otra reserva activa')
    }

    const capacity = canBookSession(session, state.bookings)
    if (!capacity.ok) {
      const entry: WaitlistEntry = {
        id: uid('wl'),
        sessionId,
        userId,
        position: nextWaitlistPosition(state.waitlist, sessionId),
        createdAt: new Date().toISOString(),
      }
      const { error: wlError } = await this.client.from('waitlist_entries').insert({
        id: entry.id,
        session_id: entry.sessionId,
        user_id: entry.userId,
        position: entry.position,
        created_at: entry.createdAt,
      })
      if (wlError) throw new Error(wlError.message)
      const waitBooking: Booking = {
        id: uid('bk'),
        sessionId,
        userId,
        status: 'waitlisted',
        createdAt: entry.createdAt,
        cancelledAt: null,
        checkInCode: uid('QR').toUpperCase(),
      }
      const { error: bkError } = await this.client.from('bookings').insert({
        id: waitBooking.id,
        session_id: waitBooking.sessionId,
        user_id: waitBooking.userId,
        status: waitBooking.status,
        created_at: waitBooking.createdAt,
        cancelled_at: null,
        check_in_code: waitBooking.checkInCode,
      })
      if (bkError) throw new Error(bkError.message)
      return entry
    }

    const booking: Booking = {
      id: uid('bk'),
      sessionId,
      userId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      cancelledAt: null,
      checkInCode: uid('QR').toUpperCase(),
    }
    const { error } = await this.client.from('bookings').insert({
      id: booking.id,
      session_id: booking.sessionId,
      user_id: booking.userId,
      status: booking.status,
      created_at: booking.createdAt,
      cancelled_at: null,
      check_in_code: booking.checkInCode,
    })
    if (error) throw new Error(error.message)
    const bookedCount =
      state.bookings.filter(
        (b) => b.sessionId === sessionId && b.status === 'confirmed',
      ).length + 1
    await this.client
      .from('sessions')
      .update({ booked_count: bookedCount })
      .eq('id', sessionId)
    return booking
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    const actor = await this.requireUser()
    const state = await this.fetchState()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Reserva no encontrada')
    if (actor.role === 'member' && booking.userId !== actor.id) {
      throw new Error('Sin permiso')
    }
    const wasConfirmed = booking.status === 'confirmed'
    const cancelledAt = new Date().toISOString()
    const { data, error } = await this.client
      .from('bookings')
      .update({ status: 'cancelled', cancelled_at: cancelledAt })
      .eq('id', bookingId)
      .select('*')
      .single()
    if (error) throw new Error(error.message)

    await this.client
      .from('waitlist_entries')
      .delete()
      .eq('session_id', booking.sessionId)
      .eq('user_id', booking.userId)

    if (wasConfirmed) {
      const promoted = promoteFirstWaitlist(state.waitlist, booking.sessionId)
      if (promoted) {
        await this.client.from('waitlist_entries').delete().eq('id', promoted.id)
        const waitBooking = state.bookings.find(
          (b) =>
            b.sessionId === booking.sessionId &&
            b.userId === promoted.userId &&
            b.status === 'waitlisted',
        )
        if (waitBooking) {
          await this.client
            .from('bookings')
            .update({ status: 'confirmed' })
            .eq('id', waitBooking.id)
        } else {
          await this.client.from('bookings').insert({
            id: uid('bk'),
            session_id: booking.sessionId,
            user_id: promoted.userId,
            status: 'confirmed',
            created_at: new Date().toISOString(),
            cancelled_at: null,
            check_in_code: uid('QR').toUpperCase(),
          })
        }
      }
    }

    const refreshed = await this.fetchState()
    const session = refreshed.sessions.find((s) => s.id === booking.sessionId)
    if (session) {
      const bookedCount = refreshed.bookings.filter(
        (b) => b.sessionId === session.id && b.status === 'confirmed',
      ).length
      await this.client
        .from('sessions')
        .update({ booked_count: bookedCount })
        .eq('id', session.id)
    }

    return mapBooking(data)
  }

  async rescheduleBooking(
    bookingId: string,
    newSessionId: string,
  ): Promise<Booking> {
    await this.cancelBooking(bookingId)
    const actor = await this.requireUser()
    const state = await this.fetchState()
    const old = state.bookings.find((b) => b.id === bookingId)
    const userId = old?.userId ?? actor.id
    const result = await this.createBooking(newSessionId, userId)
    if ('position' in result) {
      throw new Error('La nueva sesión está llena; quedaste en lista de espera')
    }
    return result
  }

  async checkIn(bookingId: string, code: string): Promise<CheckIn> {
    const actor = await this.requireUser()
    const state = await this.fetchState()
    const booking = state.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Reserva no encontrada')
    if (actor.role === 'member' && booking.userId !== actor.id) {
      throw new Error('Sin permiso para este check-in')
    }
    if (booking.checkInCode !== code.trim().toUpperCase()) {
      throw new Error('Código QR inválido')
    }
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      throw new Error('La reserva no está activa')
    }
    const session = state.sessions.find((s) => s.id === booking.sessionId)
    if (!session) throw new Error('Sesión no encontrada')
    if (
      !isCheckInWindow(
        session.startsAt,
        new Date(),
        state.settings.checkInWindowMinutes,
        10,
      )
    ) {
      throw new Error('Fuera de la ventana de check-in')
    }
    const checkIn: CheckIn = {
      id: uid('ci'),
      bookingId: booking.id,
      sessionId: session.id,
      userId: booking.userId,
      checkedInAt: new Date().toISOString(),
    }
    const { error } = await this.client.from('check_ins').insert({
      id: checkIn.id,
      booking_id: checkIn.bookingId,
      session_id: checkIn.sessionId,
      user_id: checkIn.userId,
      checked_in_at: checkIn.checkedInAt,
    })
    if (error) throw new Error(error.message)
    await this.client
      .from('bookings')
      .update({ status: 'attended' })
      .eq('id', booking.id)
    return checkIn
  }

  async listMeasurements(userId: string): Promise<BodyMeasurement[]> {
    const { data, error } = await this.client
      .from('body_measurements')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapMeasurement)
  }

  async createMeasurement(
    input: Omit<BodyMeasurement, 'id'>,
  ): Promise<BodyMeasurement> {
    const actor = await this.requireUser()
    if (!canManageWeight(actor.role, actor.id, input.userId)) {
      throw new Error('Sin permiso para registrar peso')
    }

    let effectiveHeight = input.heightCm
    if (effectiveHeight === undefined) {
      const { data: profile } = await this.client
        .from('profiles')
        .select('height_cm')
        .eq('id', input.userId)
        .maybeSingle()
      if (profile?.height_cm != null) {
        effectiveHeight = Number(profile.height_cm)
      }
    }

    const computedBmi =
      input.bmi ?? (effectiveHeight ? calculateBmi(input.weightKg, effectiveHeight) ?? undefined : undefined)

    const row: Record<string, unknown> = {
      user_id: input.userId,
      recorded_by: input.recordedBy,
      weight_kg: input.weightKg,
      height_cm: effectiveHeight,
      bmi: computedBmi,
      waist_cm: input.waistCm,
      hip_cm: input.hipCm,
      chest_cm: input.chestCm,
      arm_cm: input.armCm,
      thigh_cm: input.thighCm,
      measured_at: input.measuredAt,
      notes: input.notes,
    }
    const { data, error } = await this.client
      .from('body_measurements')
      .insert(row)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapMeasurement(data)
  }

  async updateMeasurement(
    id: string,
    patch: Partial<Omit<BodyMeasurement, 'id' | 'userId' | 'recordedBy'>>,
  ): Promise<BodyMeasurement> {
    const actor = await this.requireUser()
    const { data: existing, error: findError } = await this.client
      .from('body_measurements')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) throw new Error('Registro no encontrado')
    if (!canManageWeight(actor.role, actor.id, existing.user_id)) {
      throw new Error('Sin permiso')
    }
    const row: Record<string, unknown> = {}
    if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg
    if (patch.heightCm !== undefined) row.height_cm = patch.heightCm
    if (patch.waistCm !== undefined) row.waist_cm = patch.waistCm
    if (patch.hipCm !== undefined) row.hip_cm = patch.hipCm
    if (patch.chestCm !== undefined) row.chest_cm = patch.chestCm
    if (patch.armCm !== undefined) row.arm_cm = patch.armCm
    if (patch.thighCm !== undefined) row.thigh_cm = patch.thighCm
    if (patch.measuredAt !== undefined) row.measured_at = patch.measuredAt
    if (patch.notes !== undefined) row.notes = patch.notes

    const targetHeight = patch.heightCm ?? (existing.height_cm != null ? Number(existing.height_cm) : undefined)
    const targetWeight = patch.weightKg ?? Number(existing.weight_kg)
    if (targetHeight && targetWeight) {
      row.bmi = calculateBmi(targetWeight, targetHeight) ?? null
    }

    const { data, error } = await this.client
      .from('body_measurements')
      .update(row)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapMeasurement(data)
  }

  async deleteMeasurement(id: string): Promise<void> {
    const actor = await this.requireUser()
    const { data: existing, error: findError } = await this.client
      .from('body_measurements')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) throw new Error('Registro no encontrado')
    if (!canManageWeight(actor.role, actor.id, existing.user_id)) {
      throw new Error('Sin permiso')
    }
    const { error } = await this.client
      .from('body_measurements')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async getBodyGoal(userId: string): Promise<BodyGoal | null> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, userId)) {
      throw new Error('Sin permiso para ver metas')
    }
    const { data, error } = await this.client
      .from('body_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const goals = (data ?? []).map(mapBodyGoal)
    if (goals.length === 0) return null
    const active = goals.find((g) => g.status === 'active')
    return active ?? (goals[0] ?? null)
  }

  async listBodyGoals(userId: string): Promise<BodyGoal[]> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, userId)) {
      throw new Error('Sin permiso para ver metas')
    }
    const { data, error } = await this.client
      .from('body_goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapBodyGoal)
  }

  async upsertBodyGoal(
    goal: Omit<BodyGoal, 'id' | 'createdAt'> & { id?: string },
  ): Promise<BodyGoal> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, goal.userId)) {
      throw new Error('Sin permiso para modificar metas')
    }

    let targetBmi = goal.targetBmi
    if (targetBmi === undefined) {
      const { data: profile } = await this.client
        .from('profiles')
        .select('height_cm')
        .eq('id', goal.userId)
        .maybeSingle()
      if (profile?.height_cm != null) {
        targetBmi = calculateBmi(goal.targetWeightKg, Number(profile.height_cm)) ?? undefined
      }
    }

    if (goal.id) {
      const { data, error } = await this.client
        .from('body_goals')
        .update({
          target_weight_kg: goal.targetWeightKg,
          target_bmi: targetBmi,
          target_date: goal.targetDate,
          status: goal.status,
        })
        .eq('id', goal.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return mapBodyGoal(data)
    }

    // Cancel other active goals for this user if new goal is active
    if (goal.status === 'active') {
      await this.client
        .from('body_goals')
        .update({ status: 'cancelled' })
        .eq('user_id', goal.userId)
        .eq('status', 'active')
    }

    const { data, error } = await this.client
      .from('body_goals')
      .insert({
        user_id: goal.userId,
        target_weight_kg: goal.targetWeightKg,
        target_bmi: targetBmi,
        target_date: goal.targetDate,
        status: goal.status,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapBodyGoal(data)
  }

  async deleteBodyGoal(id: string): Promise<void> {
    const actor = await this.requireUser()
    const { data: existing, error: findError } = await this.client
      .from('body_goals')
      .select('user_id')
      .eq('id', id)
      .maybeSingle()
    if (findError) throw new Error(findError.message)
    if (!existing) throw new Error('Meta no encontrada')
    if (!canManageGoals(actor.role, actor.id, existing.user_id)) {
      throw new Error('Sin permiso')
    }
    const { error } = await this.client
      .from('body_goals')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  }

  async listMembers(): Promise<User[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('role', 'member')
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapUser)
  }

  async getMembershipPlans(): Promise<MembershipPlan[]> {
    const actor = await this.getCurrentUser()
    const { data, error } = await this.client
      .from('membership_plans')
      .select('*')
      .order('price_cents', { ascending: true })
    if (error) throw new Error(error.message)
    const plans = (data ?? []).map(mapMembershipPlan)
    if (actor && (actor.role === 'staff' || actor.role === 'admin')) {
      return plans
    }
    return plans.filter((p) => p.active)
  }

  async upsertMembershipPlan(
    plan: Partial<MembershipPlan> & { name: string; priceCents: number; durationDays: number },
  ): Promise<MembershipPlan> {
    await this.requireStaff()
    const row: Record<string, unknown> = {
      name: plan.name,
      price_cents: plan.priceCents,
      duration_days: plan.durationDays,
    }
    if (plan.id) row.id = plan.id
    if (plan.visitQuota !== undefined) row.visit_quota = plan.visitQuota
    if (plan.allowedZoneIds !== undefined) row.allowed_zone_ids = plan.allowedZoneIds
    if (plan.active !== undefined) row.active = plan.active

    const { data, error } = await this.client
      .from('membership_plans')
      .upsert(row)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return mapMembershipPlan(data)
  }

  async deleteMembershipPlan(planId: string): Promise<void> {
    await this.requireAdmin()
    const { error } = await this.client
      .from('membership_plans')
      .delete()
      .eq('id', planId)
    if (error) throw new Error(error.message)
  }

  async getMemberMembership(userId: string): Promise<Membership | null> {
    const { data, error } = await this.client
      .from('memberships')
      .select('*')
      .eq('user_id', userId)
      .order('ends_at', { ascending: false })
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return null
    const mapped = data.map(mapMembership)
    const active = mapped.find((m) => {
      const s = computeMembershipStatus(m)
      return s === 'active' || s === 'grace'
    })
    if (active) {
      return { ...active, status: computeMembershipStatus(active) }
    }
    const latest = mapped[0]
    if (!latest) return null
    return { ...latest, status: computeMembershipStatus(latest) }
  }

  async getMemberPayments(userId: string): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapPayment)
  }

  async listMemberships(): Promise<Membership[]> {
    const { data, error } = await this.client
      .from('memberships')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapMembership).map((m) => ({
      ...m,
      status: computeMembershipStatus(m),
    }))
  }

  async listPayments(): Promise<Payment[]> {
    const { data, error } = await this.client
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapPayment)
  }

  async registerManualPayment(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }): Promise<{ payment: Payment; membership: Membership }> {
    await this.requireUser()

    // 1. Get plan
    const { data: planRow, error: planError } = await this.client
      .from('membership_plans')
      .select('*')
      .eq('id', params.planId)
      .single()
    if (planError || !planRow) throw new Error('Plan no encontrado')
    const plan = mapMembershipPlan(planRow)

    // 2. Get current membership & compute extension
    const currentMembership = await this.getMemberMembership(params.userId)
    const newDates = extendMembership(currentMembership, plan, new Date())

    // 3. Upsert membership
    const membershipPayload: Record<string, unknown> = {
      user_id: params.userId,
      plan_id: plan.id,
      starts_at: newDates.startsAt,
      ends_at: newDates.endsAt,
      grace_ends_at: newDates.graceEndsAt,
      status: newDates.status,
      visits_left: newDates.visitsLeft,
    }
    if (currentMembership) {
      membershipPayload.id = currentMembership.id
    }

    const { data: memData, error: memError } = await this.client
      .from('memberships')
      .upsert(membershipPayload)
      .select('*')
      .single()
    if (memError) throw new Error(memError.message)
    const membership = mapMembership(memData)

    // 4. Insert payment
    const { data: payData, error: payError } = await this.client
      .from('payments')
      .insert({
        user_id: params.userId,
        plan_id: plan.id,
        membership_id: membership.id,
        amount_cents: params.amountCents,
        status: 'approved',
        provider: 'manual',
        manual_method: params.manualMethod,
        reference: params.reference ?? null,
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (payError) throw new Error(payError.message)
    const payment = mapPayment(payData)

    return { payment, membership }
  }
}
