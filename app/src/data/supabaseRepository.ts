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
  canManageGoals,
  canManageWeight,
  computeMembershipStatus,
  memberMembership,
  planPurchaseOutcome,
} from '@/domain/rules'
import { RECOVERY_CODE_INVALID } from '@/domain/rules/password'
import type {
  AuthCredentials,
  GymRepository,
  OnlinePaymentReceipt,
  OnlinePaymentResult,
  PagomediosDocumentType,
} from './types'
import { isSupabaseEnvConfigured } from './selectRepositoryBackend'
import { scopeGymState } from './scopeGymState'
import {
  BIOMETRIC_SESSION_EXPIRED_MESSAGE,
  clearBiometricSession,
  isBiometricsEnabled,
  readBiometricSession,
  saveBiometricSession,
} from '@/lib/biometrics'

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

type BookingRow = {
  id: string
  session_id: string
  user_id: string
  status: string
  created_at: string
  cancelled_at: string | null
  check_in_code: string
}

type WaitlistRow = {
  id: string
  session_id: string
  user_id: string
  position: number
  created_at: string
}

function mapBooking(row: BookingRow): Booking {
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

function mapWaitlist(row: WaitlistRow): WaitlistEntry {
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
  recorded_by: string | null
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
    recordedBy: row.recorded_by ?? '',
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
  kind?: string | null
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
    // Sin columna kind (antes de plan-rules.sql) queda undefined y decide el nombre.
    kind: row.kind === 'day_pass' || row.kind === 'membership' ? row.kind : undefined,
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
  mp_payment_id?: string | null
  notes?: string | null
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
    authorizationCode: row.provider === 'pagomedios' ? (row.mp_payment_id ?? null) : null,
    notes: row.notes ?? null,
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
          primaryColor: '#231F20',
          accentColor: '#F26D17',
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
      // Email confirmation activo: cuenta creada sin sesión.
      // No es un fallo técnico — la UI lo muestra como éxito.
      throw new Error(
        'PENDING_EMAIL_CONFIRMATION:Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.',
      )
    }
    return user
  }

  async signOut(): Promise<void> {
    const keepQuickAccess =
      isBiometricsEnabled() && readBiometricSession()?.kind === 'supabase'
    const { error } = await this.client.auth.signOut(
      keepQuickAccess ? { scope: 'local' } : undefined,
    )
    if (error) throw new Error(error.message)
  }

  async rememberBiometricSession(): Promise<void> {
    const { data, error } = await this.client.auth.getSession()
    if (error || !data.session?.access_token || !data.session.refresh_token) {
      throw new Error('No hay sesión activa')
    }
    saveBiometricSession({
      kind: 'supabase',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    })
  }

  async restoreBiometricSession(): Promise<User> {
    const saved = readBiometricSession()
    if (!saved || saved.kind !== 'supabase') {
      throw new Error(BIOMETRIC_SESSION_EXPIRED_MESSAGE)
    }
    const { error } = await this.client.auth.setSession({
      access_token: saved.accessToken,
      refresh_token: saved.refreshToken,
    })
    if (error) {
      clearBiometricSession()
      throw new Error(BIOMETRIC_SESSION_EXPIRED_MESSAGE)
    }
    const user = await this.getCurrentUser()
    if (!user) {
      clearBiometricSession()
      throw new Error(BIOMETRIC_SESSION_EXPIRED_MESSAGE)
    }
    return user
  }

  /**
   * Envía el correo de recuperación. La plantilla "Reset Password" de Supabase
   * lleva el código ({{ .Token }}), no un enlace: así funciona igual dentro de
   * la app nativa, donde un enlace a la web no vuelve a la app.
   */
  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim())
    if (error) throw new Error(error.message)
  }

  async completePasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    const { error: otpError } = await this.client.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    })
    if (otpError) throw new Error(RECOVERY_CODE_INVALID)

    // El código ya abrió sesión: se cierra pase lo que pase, porque es de un
    // solo uso y el socio debe entrar desde el login con la clave nueva.
    const { error } = await this.client.auth.updateUser({ password: newPassword })
    await this.client.auth.signOut()
    if (error) {
      throw new Error(
        error.code === 'same_password'
          ? 'La contraseña nueva debe ser distinta a la anterior. Pide un código nuevo e inténtalo otra vez.'
          : error.message,
      )
    }
  }

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    })
    if (error) throw new Error(error.message)
  }

  /**
   * Borra auth.users y, en cascada, el perfil y todos sus datos (schema.sql).
   * Los DELETE directos no sirven: RLS los ignora sin error.
   */
  async deleteAccount(): Promise<void> {
    await this.requireUser()
    const { error } = await this.client.rpc('delete_user_account')
    if (error) throw new Error(error.message)
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

  /**
   * Cupo, lista de espera y promoción se deciden en la base (booking-rpc.sql),
   * bloqueando la sesión: dos reservas simultáneas no pueden pasarse del aforo
   * (ZCAPP-53) y la promoción revisa solapamiento y membresía (ZCAPP-54).
   */
  async createBooking(
    sessionId: string,
    userId: string,
  ): Promise<Booking | WaitlistEntry> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('book_session', {
      p_session_id: sessionId,
      p_user_id: userId,
    })
    if (error) throw new Error(error.message)
    const result = data as { booking?: BookingRow; waitlist?: WaitlistRow }
    if (result.waitlist) return mapWaitlist(result.waitlist)
    return mapBooking(result.booking!)
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('cancel_booking', {
      p_booking_id: bookingId,
    })
    if (error) throw new Error(error.message)
    return mapBooking(data as BookingRow)
  }

  /** Mueve la reserva en un solo paso (reschedule_booking): si falla, no cambia nada. */
  async rescheduleBooking(
    bookingId: string,
    newSessionId: string,
  ): Promise<Booking> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('reschedule_booking', {
      p_booking_id: bookingId,
      p_session_id: newSessionId,
    })
    if (error) throw new Error(error.message)
    return mapBooking(data as BookingRow)
  }

  /** Código, estado y ventana se validan en la base (check_in_booking en booking-rpc.sql). */
  async checkIn(bookingId: string, code: string): Promise<CheckIn> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('check_in_booking', {
      p_booking_id: bookingId,
      p_code: code,
    })
    if (error) throw new Error(error.message)
    return mapCheckIn(data as Parameters<typeof mapCheckIn>[0])
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
    await this.requireAdmin()
    const row: Record<string, unknown> = {
      name: plan.name,
      price_cents: plan.priceCents,
      duration_days: plan.durationDays,
    }
    if (plan.id) row.id = plan.id
    if (plan.visitQuota !== undefined) row.visit_quota = plan.visitQuota
    if (plan.allowedZoneIds !== undefined) row.allowed_zone_ids = plan.allowedZoneIds
    if (plan.active !== undefined) row.active = plan.active
    if (plan.kind !== undefined) row.kind = plan.kind

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

  /** Membresías del socio con su plan embebido (para distinguir pases del día). */
  private async membershipsWithPlans(
    userId: string,
  ): Promise<{ memberships: Membership[]; plans: MembershipPlan[] }> {
    const { data, error } = await this.client
      .from('memberships')
      .select('*, membership_plans(*)')
      .eq('user_id', userId)
      .order('ends_at', { ascending: false })
    if (error) throw new Error(error.message)
    const rows = data ?? []
    const plans = rows.flatMap((row) =>
      row.membership_plans ? [mapMembershipPlan(row.membership_plans)] : [],
    )
    return { memberships: rows.map(mapMembership), plans }
  }

  async getMemberMembership(userId: string): Promise<Membership | null> {
    const { memberships, plans } = await this.membershipsWithPlans(userId)
    return memberMembership(memberships, plans)
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

  async requestPlanPayment(params: {
    planId: string
    manualMethod: ManualPaymentMethod
  }): Promise<Payment> {
    const user = await this.requireUser()
    if (user.role !== 'member') {
      throw new Error('Solo un socio puede solicitar un plan')
    }
    const { data: planRow, error: planError } = await this.client
      .from('membership_plans')
      .select('*')
      .eq('id', params.planId)
      .eq('active', true)
      .single()
    if (planError || !planRow) throw new Error('Plan no encontrado')
    const plan = mapMembershipPlan(planRow)
    const mine = await this.membershipsWithPlans(user.id)
    const outcome = planPurchaseOutcome({ ...mine, plan })
    if (outcome.kind === 'reject') throw new Error(outcome.reason)

    const { data: existing, error: existingError } = await this.client
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('provider', 'manual')
      .is('membership_id', null)
      .maybeSingle()
    if (existingError) throw new Error(existingError.message)

    const payload = {
      user_id: user.id,
      plan_id: plan.id,
      membership_id: null,
      amount_cents: plan.priceCents,
      status: 'pending',
      provider: 'manual',
      manual_method: params.manualMethod,
      reference: null,
    }
    const query = existing
      ? this.client.from('payments').update(payload).eq('id', existing.id)
      : this.client.from('payments').insert(payload)
    const { data, error } = await query.select('*').single()
    if (error) throw new Error(error.message)
    return mapPayment(data)
  }

  async registerManualPayment(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }): Promise<{ payment: Payment; membership: Membership }> {
    await this.requireUser()

    // La base decide vigente / en espera / pase del día y bloquea al socio (plan-rules.sql)
    const { data: memData, error: memError } = await this.client.rpc('apply_plan_purchase', {
      p_user_id: params.userId,
      p_plan_id: params.planId,
    })
    if (memError) throw new Error(memError.message)
    const membershipRow = mapMembership(memData)
    const membership = { ...membershipRow, status: computeMembershipStatus(membershipRow) }

    // Aprueba la solicitud pendiente o registra un cobro nuevo
    const { data: pending, error: pendingError } = await this.client
      .from('payments')
      .select('id, created_at, reference')
      .eq('user_id', params.userId)
      .eq('status', 'pending')
      .eq('provider', 'manual')
      .is('membership_id', null)
      .maybeSingle()
    if (pendingError) throw new Error(pendingError.message)

    const paymentPayload = {
      user_id: params.userId,
      plan_id: params.planId,
      membership_id: membership.id,
      amount_cents: params.amountCents,
      status: 'approved',
      provider: 'manual',
      manual_method: params.manualMethod,
      reference: params.reference ?? pending?.reference ?? null,
      approved_at: new Date().toISOString(),
    }
    const paymentQuery = pending
      ? this.client.from('payments').update(paymentPayload).eq('id', pending.id)
      : this.client.from('payments').insert({
          ...paymentPayload,
          created_at: new Date().toISOString(),
        })
    const { data: payData, error: payError } = await paymentQuery.select('*').single()
    if (payError) throw new Error(payError.message)
    const payment = mapPayment(payData)

    return { payment, membership }
  }

  async changePlanNow(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
  }): Promise<{ payment: Payment; membership: Membership }> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('change_plan_now', {
      p_user_id: params.userId,
      p_plan_id: params.planId,
      p_amount_cents: params.amountCents,
      p_method: params.manualMethod,
    })
    if (error) throw new Error(error.message)
    const membership = mapMembership(data.membership)
    return {
      payment: mapPayment(data.payment),
      membership: { ...membership, status: computeMembershipStatus(membership) },
    }
  }

  async refundPayment(params: { paymentId: string; cancelMembership: boolean }): Promise<Payment> {
    await this.requireUser()
    const { data, error } = await this.client.rpc('refund_payment', {
      p_payment_id: params.paymentId,
      p_cancel_membership: params.cancelMembership,
    })
    if (error) throw new Error(error.message)
    return mapPayment(data)
  }

  async createOnlineCheckout(params: {
    planId: string
    phone: string
    identification: string
    street?: string
  }): Promise<{
    checkoutId: string
    paymentId: string
    widgetScriptUrl: string
    shopperResultUrl: string
  }> {
    await this.requireUser()
    const { data, error } = await this.client.functions.invoke(
      'create-datafast-checkout',
      { body: params },
    )

    const payload = (data ?? {}) as {
      checkoutId?: string
      paymentId?: string
      widgetScriptUrl?: string
      shopperResultUrl?: string
      error?: string
    }

    if (
      payload.checkoutId &&
      payload.paymentId &&
      payload.widgetScriptUrl &&
      payload.shopperResultUrl
    ) {
      return {
        checkoutId: payload.checkoutId,
        paymentId: payload.paymentId,
        widgetScriptUrl: payload.widgetScriptUrl,
        shopperResultUrl: payload.shopperResultUrl,
      }
    }

    if (payload.error) throw new Error(payload.error)
    if (error) throw new Error(error.message || 'No se pudo iniciar el pago Datafast')
    throw new Error('Pasarela Datafast no disponible. Revisa secrets en Supabase.')
  }

  async verifyOnlinePayment(params: {
    paymentId: string
    resourcePath: string
  }): Promise<{ ok: boolean; description?: string }> {
    await this.requireUser()
    const { data, error } = await this.client.functions.invoke(
      'verify-datafast-payment',
      { body: params },
    )
    const payload = (data ?? {}) as {
      ok?: boolean
      description?: string
      error?: string
    }
    if (payload.ok) return { ok: true }
    if (payload.error) throw new Error(payload.error)
    if (error) throw new Error(error.message || 'No se pudo verificar el pago')
    return { ok: false, description: payload.description ?? 'Pago no aprobado' }
  }

  async createPagomediosPayment(params: {
    planId: string
    document: string
    documentType: PagomediosDocumentType
    phone: string
    address: string
    native?: boolean
  }): Promise<{ url: string; paymentId: string }> {
    await this.requireUser()
    const { data, error } = await this.invokePagomedios({ action: 'create', ...params })
    const payload = (data ?? {}) as { url?: string; paymentId?: string; error?: string }
    if (payload.url && payload.paymentId) {
      return { url: payload.url, paymentId: payload.paymentId }
    }
    if (payload.error) throw new Error(payload.error)
    throw new Error(
      (await functionErrorMessage(error)) ??
        'Pasarela Pagomedios no disponible. Revisa secrets en Supabase.',
    )
  }

  async verifyPagomediosPayment(params: { paymentId: string }): Promise<OnlinePaymentResult> {
    await this.requireUser()
    const { data, error } = await this.invokePagomedios({
      action: 'verify',
      paymentId: params.paymentId,
    })
    const payload = (data ?? {}) as {
      status?: OnlinePaymentResult['status']
      description?: string
      receipt?: OnlinePaymentReceipt
      error?: string
    }
    if (payload.status) {
      return { status: payload.status, description: payload.description, receipt: payload.receipt }
    }
    if (payload.error) throw new Error(payload.error)
    throw new Error((await functionErrorMessage(error)) ?? 'No se pudo verificar el pago')
  }

  /** En dev, VITE_FUNCTIONS_URL apunta a la función corriendo con Deno (simulador local). */
  private async invokePagomedios(
    body: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }> {
    const localUrl = import.meta.env.DEV ? import.meta.env.VITE_FUNCTIONS_URL : undefined
    if (!localUrl) return this.client.functions.invoke('pagomedios-payment', { body })
    const {
      data: { session },
    } = await this.client.auth.getSession()
    const res = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    return { data, error: res.ok ? null : new Error(`Función local respondió ${res.status}`) }
  }
}

/** Las Edge Functions responden JSON { error } con status != 2xx; invoke() lo esconde en error.context. */
async function functionErrorMessage(error: unknown): Promise<string | null> {
  if (!error) return null
  const context = (error as { context?: unknown }).context
  if (context instanceof Response) {
    const body = await context.clone().json().catch(() => null)
    if (body && typeof body.error === 'string') return body.error
  }
  return error instanceof Error ? error.message : null
}
