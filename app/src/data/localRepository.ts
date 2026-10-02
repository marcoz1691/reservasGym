import type {
  BodyGoal,
  BodyMeasurement,
  Booking,
  CheckIn,
  ClassTemplate,
  GymSettings,
  GymState,
  ManualPaymentMethod,
  Membership,
  MembershipPlan,
  Payment,
  Session,
  User,
  WaitlistEntry,
  Zone,
} from '../domain/models'
import {
  calculateBmi,
  assertMemberBookingAllowed,
  canBookSession,
  canManageGoals,
  canManageWeight,
  computeMembershipStatus,
  extendMembership,
  hasOverlap,
  isCheckInWindow,
  nextWaitlistPosition,
  pickWaitlistPromotion,
  reindexWaitlist,
  RESCHEDULE_FULL_MESSAGE,
  seatsTaken,
} from '../domain/rules'
import { SESSION_FULL_MESSAGE, assertPlanSellableInApp, isFeatureEnabled } from '../domain/rules'
import { RECOVERY_CODE_INVALID, RECOVERY_CODE_TTL_MS } from '../domain/rules/password'
import type {
  AuthCredentials,
  GymRepository,
  OnlinePaymentResult,
  PagomediosDocumentType,
} from './types'
import { createSeedState, DEMO_PASSWORD } from './seed'
import {
  hashSecret,
  newSalt,
  newSessionToken,
  verifySecret,
} from './demoAuth'
import { scopeGymState } from './scopeGymState'
import {
  BIOMETRIC_SESSION_EXPIRED_MESSAGE,
  readBiometricSession,
  saveBiometricSession,
} from '@/lib/biometrics'

const STORAGE_KEY = 'reservasgym.intermedia.v2'
const SESSION_KEY = 'reservasgym.session.v2'
const CREDS_KEY = 'reservasgym.creds.v1'
/** Solo demo: simula el código de recuperación que en prod llega por correo. */
const RECOVERY_KEY = 'reservasgym.recovery.v2'

type RecoveryPayload = { userId: string; code: string; expiresAt: number }

function readRecovery(): RecoveryPayload | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    return raw ? (JSON.parse(raw) as RecoveryPayload) : null
  } catch {
    return null
  }
}

function newRecoveryCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000
  return String(n).padStart(6, '0')
}
/** Legacy key — cleared so plain user-id sessions cannot be forged. */
const LEGACY_SESSION_KEY = 'reservasgym.sessionUserId'

type SessionPayload = { userId: string; token: string }
type CredRecord = {
  passwordSalt: string
  passwordHash: string
  sessionToken: string | null
}
type CredStore = Record<string, CredRecord>

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function readCreds(): CredStore {
  const raw = localStorage.getItem(CREDS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as CredStore
  } catch {
    return {}
  }
}

function writeCreds(creds: CredStore) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
}

function readSession(): SessionPayload | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SessionPayload
    if (!parsed?.userId || !parsed?.token) return null
    return parsed
  } catch {
    return null
  }
}

export class LocalRepository implements GymRepository {
  private state: GymState
  private currentUserId: string | null
  private sessionToken: string | null
  private credsReady: Promise<void>

  constructor() {
    localStorage.removeItem(LEGACY_SESSION_KEY)
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as GymState
      const seed = createSeedState()
      this.state = {
        ...seed,
        ...parsed,
        bodyGoals: parsed.bodyGoals ?? seed.bodyGoals ?? [],
        membershipPlans: parsed.membershipPlans ?? seed.membershipPlans,
        memberships: parsed.memberships ?? seed.memberships,
        payments: parsed.payments ?? seed.payments,
      }
    } else {
      this.state = createSeedState()
    }
    this.currentUserId = null
    this.sessionToken = null
    this.credsReady = this.bootstrapCredsAndSession()
    this.persistState()
  }

  private async bootstrapCredsAndSession() {
    const creds = readCreds()
    for (const user of this.state.users) {
      if (creds[user.id]) continue
      const passwordSalt = newSalt()
      creds[user.id] = {
        passwordSalt,
        passwordHash: await hashSecret(DEMO_PASSWORD, passwordSalt),
        sessionToken: null,
      }
    }
    writeCreds(creds)

    const session = readSession()
    if (!session) return
    const record = creds[session.userId]
    if (!record?.sessionToken || record.sessionToken !== session.token) {
      localStorage.removeItem(SESSION_KEY)
      return
    }
    if (!this.state.users.some((u) => u.id === session.userId)) {
      localStorage.removeItem(SESSION_KEY)
      return
    }
    this.currentUserId = session.userId
    this.sessionToken = session.token
  }

  private async ensureReady() {
    await this.credsReady
  }

  resetDemo() {
    this.state = createSeedState()
    this.currentUserId = null
    this.sessionToken = null
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(CREDS_KEY)
    this.credsReady = this.bootstrapCredsAndSession()
    this.persistState()
  }

  private persistState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
  }

  private persistSession() {
    if (this.currentUserId && this.sessionToken) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          userId: this.currentUserId,
          token: this.sessionToken,
        } satisfies SessionPayload),
      )
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }

  private async setSession(userId: string) {
    const token = newSessionToken()
    const creds = readCreds()
    const record = creds[userId]
    if (!record) throw new Error('Credenciales no inicializadas')
    record.sessionToken = token
    writeCreds(creds)
    this.currentUserId = userId
    this.sessionToken = token
    this.persistSession()
  }

  private clearSession() {
    if (this.currentUserId) {
      const creds = readCreds()
      const record = creds[this.currentUserId]
      if (record) {
        record.sessionToken = null
        writeCreds(creds)
      }
    }
    this.currentUserId = null
    this.sessionToken = null
    this.persistSession()
  }

  private async requireUser(): Promise<User> {
    await this.ensureReady()
    const user = this.state.users.find((u) => u.id === this.currentUserId)
    if (!user || !this.sessionToken) throw new Error('No hay sesión activa')
    const record = readCreds()[user.id]
    if (!record?.sessionToken || record.sessionToken !== this.sessionToken) {
      throw new Error('No hay sesión activa')
    }
    return user
  }

  async load(): Promise<GymState> {
    await this.ensureReady()
    const actor = this.currentUserId
      ? (this.state.users.find((u) => u.id === this.currentUserId) ?? null)
      : null
    if (actor && this.sessionToken) {
      const record = readCreds()[actor.id]
      if (!record?.sessionToken || record.sessionToken !== this.sessionToken) {
        return scopeGymState(this.state, null)
      }
    }
    return scopeGymState(this.state, actor)
  }

  async getCurrentUser(): Promise<User | null> {
    await this.ensureReady()
    if (!this.currentUserId || !this.sessionToken) return null
    const record = readCreds()[this.currentUserId]
    if (!record?.sessionToken || record.sessionToken !== this.sessionToken) {
      this.clearSession()
      return null
    }
    const user = this.state.users.find((u) => u.id === this.currentUserId)
    return user ? { ...user } : null
  }

  async signIn(creds: AuthCredentials): Promise<User> {
    await this.ensureReady()
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === creds.email.toLowerCase(),
    )
    if (!user) throw new Error('Usuario no encontrado. Prueba socio@gym.local')
    const record = readCreds()[user.id]
    if (!record) throw new Error('Credenciales no inicializadas')
    const ok = await verifySecret(
      creds.password,
      record.passwordSalt,
      record.passwordHash,
    )
    if (!ok) throw new Error('Contraseña incorrecta')
    await this.setSession(user.id)
    this.persistState()
    return { ...user }
  }

  async signUp(creds: AuthCredentials): Promise<User> {
    await this.ensureReady()
    if (!creds.fullName?.trim()) throw new Error('Nombre requerido')
    if (!creds.password || creds.password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres')
    }
    if (this.state.users.some((u) => u.email.toLowerCase() === creds.email.toLowerCase())) {
      throw new Error('Ese correo ya está registrado')
    }
    const user: User = {
      id: uid('user'),
      email: creds.email.trim().toLowerCase(),
      fullName: creds.fullName.trim(),
      role: 'member',
      createdAt: new Date().toISOString(),
      birthDate: creds.birthDate?.trim() || undefined,
      residence: creds.residence?.trim() || undefined,
      heightCm: creds.heightCm ? Number(creds.heightCm) : undefined,
      initialWeightKg: creds.initialWeightKg ? Number(creds.initialWeightKg) : undefined,
      goals: creds.goals?.trim() || undefined,
      healthNotes: creds.healthNotes?.trim() || undefined,
    }
    const passwordSalt = newSalt()
    const store = readCreds()
    store[user.id] = {
      passwordSalt,
      passwordHash: await hashSecret(creds.password, passwordSalt),
      sessionToken: null,
    }
    writeCreds(store)
    this.state.users.push(user)

    if (user.initialWeightKg && user.initialWeightKg > 0) {
      this.state.measurements.push({
        id: uid('meas'),
        userId: user.id,
        recordedBy: user.id,
        weightKg: Number(user.initialWeightKg),
        measuredAt: user.createdAt,
        notes: 'Registro inicial al crear cuenta',
      })
    }

    await this.setSession(user.id)
    this.persistState()
    return { ...user }
  }

  async signOut(): Promise<void> {
    await this.ensureReady()
    this.clearSession()
    this.persistState()
  }

  async rememberBiometricSession(): Promise<void> {
    const user = await this.requireUser()
    saveBiometricSession({ kind: 'local', userId: user.id })
  }

  async restoreBiometricSession(): Promise<User> {
    await this.ensureReady()
    const saved = readBiometricSession()
    if (!saved || saved.kind !== 'local') {
      throw new Error(BIOMETRIC_SESSION_EXPIRED_MESSAGE)
    }
    const user = this.state.users.find((candidate) => candidate.id === saved.userId)
    if (!user) throw new Error(BIOMETRIC_SESSION_EXPIRED_MESSAGE)
    await this.setSession(user.id)
    this.persistState()
    return { ...user }
  }

  async resetPassword(email: string): Promise<void> {
    await this.ensureReady()
    const normalized = email.trim().toLowerCase()
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === normalized,
    )
    if (!user) {
      // Se resuelve igual aunque no exista: revelar qué correos están
      // registrados permitiría enumerar socios.
      return
    }
    // En demo no hay correo: el código queda guardado y la pantalla lo muestra
    // (peekRecoveryCode). Pedir otro reemplaza al anterior.
    const payload: RecoveryPayload = {
      userId: user.id,
      code: newRecoveryCode(),
      expiresAt: Date.now() + RECOVERY_CODE_TTL_MS,
    }
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(payload))
  }

  /** Solo demo: el código que en producción llegaría por correo. */
  peekRecoveryCode(): string | null {
    return readRecovery()?.code ?? null
  }

  async completePasswordReset(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    await this.ensureReady()
    const recovery = readRecovery()
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    )
    const valid =
      recovery !== null &&
      user !== undefined &&
      recovery.userId === user.id &&
      recovery.code === code.trim() &&
      Date.now() <= recovery.expiresAt
    if (!valid) throw new Error(RECOVERY_CODE_INVALID)
    await this.writePassword(user.id, newPassword)
    // Un solo uso, y sin sesión: el socio entra desde el login con la clave nueva.
    localStorage.removeItem(RECOVERY_KEY)
    this.clearSession()
    this.persistState()
  }

  async updatePassword(newPassword: string): Promise<void> {
    await this.ensureReady()
    const userId = readSession()?.userId
    if (!userId) throw new Error('No hay sesión activa')
    await this.writePassword(userId, newPassword)
    // Se vuelve a abrir la sesión de este dispositivo; las demás quedan cerradas.
    await this.setSession(userId)
    this.persistState()
  }

  private async writePassword(userId: string, newPassword: string): Promise<void> {
    const user = this.state.users.find((u) => u.id === userId)
    if (!user) throw new Error('Usuario no encontrado')

    const creds = readCreds()
    const passwordSalt = newSalt()
    creds[userId] = {
      passwordSalt,
      passwordHash: await hashSecret(newPassword, passwordSalt),
      // Invalida cualquier sesión abierta con la contraseña anterior:
      // cambiar la clave debe cerrar las demás sesiones.
      sessionToken: null,
    }
    writeCreds(creds)
  }

  async deleteAccount(): Promise<void> {
    const actor = await this.requireUser()
    const userId = actor.id

    // Remove user bookings, waitlist, check-ins, measurements, body goals, memberships, payments, and profile (Apple 5.1.1(v) & Google Play)
    this.state.bookings = this.state.bookings.filter((b) => b.userId !== userId)
    this.state.waitlist = this.state.waitlist.filter((w) => w.userId !== userId)
    this.state.checkIns = this.state.checkIns.filter((c) => c.userId !== userId)
    this.state.measurements = this.state.measurements.filter((m) => m.userId !== userId)
    this.state.bodyGoals = (this.state.bodyGoals ?? []).filter((g) => g.userId !== userId)
    this.state.memberships = (this.state.memberships ?? []).filter((m) => m.userId !== userId)
    this.state.payments = (this.state.payments ?? []).filter((p) => p.userId !== userId)
    this.state.users = this.state.users.filter((u) => u.id !== userId)

    const creds = readCreds()
    delete creds[userId]
    writeCreds(creds)

    this.clearSession()
    this.persistState()
  }

  async updateProfile(
    patch: Partial<Omit<User, 'id' | 'email' | 'role' | 'createdAt'>>,
  ): Promise<User> {
    const actor = await this.requireUser()
    const user = this.state.users.find((u) => u.id === actor.id)
    if (!user) throw new Error('Usuario no encontrado')
    if (patch.fullName !== undefined) user.fullName = patch.fullName.trim()
    if (patch.birthDate !== undefined) user.birthDate = patch.birthDate.trim() || undefined
    if (patch.residence !== undefined) user.residence = patch.residence.trim() || undefined
    if (patch.heightCm !== undefined) user.heightCm = patch.heightCm ? Number(patch.heightCm) : undefined
    if (patch.initialWeightKg !== undefined) {
      user.initialWeightKg = patch.initialWeightKg ? Number(patch.initialWeightKg) : undefined
      const hasMeas = this.state.measurements.some((m) => m.userId === user.id)
      if (!hasMeas && user.initialWeightKg && user.initialWeightKg > 0) {
        this.state.measurements.push({
          id: uid('meas'),
          userId: user.id,
          recordedBy: user.id,
          weightKg: Number(user.initialWeightKg),
          heightCm: user.heightCm,
          measuredAt: new Date().toISOString(),
          notes: 'Registro inicial de ficha técnica',
        })
      }
    }
    if (patch.goals !== undefined) user.goals = patch.goals.trim() || undefined
    if (patch.healthNotes !== undefined) user.healthNotes = patch.healthNotes.trim() || undefined
    this.persistState()
    return { ...user }
  }

  async updateSettings(patch: Partial<GymSettings>): Promise<GymSettings> {
    const actor = await this.requireUser()
    if (actor.role !== 'admin') throw new Error('Solo admin')
    this.state.settings = { ...this.state.settings, ...patch }
    this.persistState()
    return { ...this.state.settings }
  }

  async listZones(): Promise<Zone[]> {
    return this.state.zones.map((z) => ({ ...z }))
  }

  async upsertZone(zone: Zone): Promise<Zone> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')
    const idx = this.state.zones.findIndex((z) => z.id === zone.id)
    if (idx >= 0) this.state.zones[idx] = zone
    else this.state.zones.push(zone)
    this.persistState()
    return { ...zone }
  }

  async deleteZone(id: string): Promise<void> {
    const actor = await this.requireUser()
    if (actor.role !== 'admin') throw new Error('Solo admin')
    this.state.zones = this.state.zones.filter((z) => z.id !== id)
    this.persistState()
  }

  async listTemplates(): Promise<ClassTemplate[]> {
    return this.state.templates.map((t) => ({ ...t }))
  }

  async upsertTemplate(template: ClassTemplate): Promise<ClassTemplate> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')
    const idx = this.state.templates.findIndex((t) => t.id === template.id)
    if (idx >= 0) this.state.templates[idx] = template
    else this.state.templates.push(template)
    this.persistState()
    return { ...template }
  }

  async deleteTemplate(id: string): Promise<void> {
    const actor = await this.requireUser()
    if (actor.role !== 'admin') throw new Error('Solo admin')
    this.state.templates = this.state.templates.filter((t) => t.id !== id)
    this.persistState()
  }

  async listSessions(fromIso?: string, toIso?: string): Promise<Session[]> {
    let sessions = this.state.sessions
    if (fromIso) {
      const from = new Date(fromIso).getTime()
      sessions = sessions.filter((s) => new Date(s.startsAt).getTime() >= from)
    }
    if (toIso) {
      const to = new Date(toIso).getTime()
      sessions = sessions.filter((s) => new Date(s.startsAt).getTime() <= to)
    }
    return sessions
      .map((s) => ({ ...s }))
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
  }

  async upsertSession(session: Session): Promise<Session> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')
    const idx = this.state.sessions.findIndex((s) => s.id === session.id)
    if (idx >= 0) this.state.sessions[idx] = session
    else this.state.sessions.push(session)
    this.persistState()
    return { ...session }
  }

  async deleteSession(id: string): Promise<void> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')
    this.state.sessions = this.state.sessions.filter((s) => s.id !== id)
    this.persistState()
  }

  async listBookingsForUser(userId: string): Promise<Booking[]> {
    return this.state.bookings
      .filter((b) => b.userId === userId)
      .map((b) => ({ ...b }))
  }

  async createBooking(
    sessionId: string,
    userId: string,
  ): Promise<Booking | WaitlistEntry> {
    const actor = await this.requireUser()
    if (actor.role === 'member' && actor.id !== userId) {
      throw new Error('No puedes reservar por otro socio')
    }
    const session = this.state.sessions.find((s) => s.id === sessionId)
    if (!session) throw new Error('Sesión no encontrada')
    if (actor.role === 'member' && new Date(session.startsAt).getTime() <= Date.now()) {
      throw new Error('Esa clase ya empezó')
    }

    const already = this.state.bookings.find(
      (b) =>
        b.sessionId === sessionId &&
        b.userId === userId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'waitlisted'),
    )
    if (already) throw new Error('Ya tienes reserva en esta sesión')

    if (hasOverlap(this.state.sessions, this.state.bookings, userId, session)) {
      throw new Error('Se solapa con otra reserva activa')
    }

    const subject = this.state.users.find((u) => u.id === userId)
    if (subject?.role === 'member' || actor.role === 'member') {
      const allowed = this.memberBookingAllowed(userId, session.zoneId)
      if (!allowed.ok) throw new Error(allowed.reason)
    }

    const capacity = canBookSession(session, this.state.bookings)
    if (!capacity.ok) {
      if (!isFeatureEnabled(this.state.settings, 'waitlist')) {
        throw new Error(SESSION_FULL_MESSAGE)
      }
      const entry: WaitlistEntry = {
        id: uid('wl'),
        sessionId,
        userId,
        position: nextWaitlistPosition(this.state.waitlist, sessionId),
        createdAt: new Date().toISOString(),
      }
      this.state.waitlist.push(entry)
      const waitBooking: Booking = {
        id: uid('bk'),
        sessionId,
        userId,
        status: 'waitlisted',
        createdAt: entry.createdAt,
        cancelledAt: null,
        checkInCode: uid('QR').toUpperCase(),
      }
      this.state.bookings.push(waitBooking)
      this.persistState()
      return { ...entry }
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
    this.state.bookings.push(booking)
    session.bookedCount = seatsTaken(this.state.bookings, sessionId)
    this.persistState()
    return { ...booking }
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    const actor = await this.requireUser()
    const booking = this.state.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Reserva no encontrada')
    if (actor.role === 'member' && booking.userId !== actor.id) {
      throw new Error('Sin permiso')
    }
    const wasConfirmed = booking.status === 'confirmed'
    booking.status = 'cancelled'
    booking.cancelledAt = new Date().toISOString()

    this.state.waitlist = this.state.waitlist.filter(
      (w) => !(w.sessionId === booking.sessionId && w.userId === booking.userId),
    )

    if (wasConfirmed) this.promoteFromWaitlist(booking.sessionId)
    this.state.waitlist = reindexWaitlist(this.state.waitlist, booking.sessionId)

    const session = this.state.sessions.find((s) => s.id === booking.sessionId)
    if (session) {
      session.bookedCount = seatsTaken(this.state.bookings, session.id)
    }
    this.persistState()
    return { ...booking }
  }

  private memberBookingAllowed(userId: string, zoneId: string) {
    const membership = (this.state.memberships ?? []).find((m) => m.userId === userId)
    const plan = membership
      ? (this.state.membershipPlans ?? []).find((p) => p.id === membership.planId)
      : undefined
    return assertMemberBookingAllowed(membership, plan, zoneId)
  }

  /**
   * Sube al primero elegible de la cola. Quien se solapa con otra reserva o ya
   * no puede reservar sale de la cola y su reserva en espera se cancela (ZCAPP-54).
   */
  private promoteFromWaitlist(sessionId: string): void {
    const session = this.state.sessions.find((s) => s.id === sessionId)
    if (!session) return
    const { promoted, skipped } = pickWaitlistPromotion(
      this.state.waitlist,
      sessionId,
      (entry) => {
        if (hasOverlap(this.state.sessions, this.state.bookings, entry.userId, session)) {
          return false
        }
        const subject = this.state.users.find((u) => u.id === entry.userId)
        return subject?.role !== 'member' || this.memberBookingAllowed(entry.userId, session.zoneId).ok
      },
    )

    const leaving = new Set([...skipped, promoted].map((w) => w?.id))
    this.state.waitlist = this.state.waitlist.filter((w) => !leaving.has(w.id))
    const waitingBooking = (userId: string) =>
      this.state.bookings.find(
        (b) => b.sessionId === sessionId && b.userId === userId && b.status === 'waitlisted',
      )

    const now = new Date().toISOString()
    for (const entry of skipped) {
      const skippedBooking = waitingBooking(entry.userId)
      if (skippedBooking) {
        skippedBooking.status = 'cancelled'
        skippedBooking.cancelledAt = now
      }
    }

    if (!promoted) return
    const promotedBooking = waitingBooking(promoted.userId)
    if (promotedBooking) promotedBooking.status = 'confirmed'
    else {
      this.state.bookings.push({
        id: uid('bk'),
        sessionId,
        userId: promoted.userId,
        status: 'confirmed',
        createdAt: now,
        cancelledAt: null,
        checkInCode: uid('QR').toUpperCase(),
      })
    }
  }

  async rescheduleBooking(
    bookingId: string,
    newSessionId: string,
  ): Promise<Booking> {
    // Igual que reschedule_booking en SQL: se valida todo en la sesión nueva
    // antes de tocar la reserva original, así un fallo no deja nada a medias.
    const actor = await this.requireUser()
    const old = this.state.bookings.find((b) => b.id === bookingId)
    if (!old) throw new Error('Reserva no encontrada')
    if (actor.role === 'member' && old.userId !== actor.id) throw new Error('Sin permiso')
    const next = this.state.sessions.find((s) => s.id === newSessionId)
    if (!next) throw new Error('Sesión no encontrada')
    if (new Date(next.startsAt).getTime() <= Date.now()) {
      throw new Error('Esa clase ya empezó')
    }
    const userId = old.userId
    if (!['confirmed', 'pending', 'waitlisted'].includes(old.status)) {
      throw new Error('Esta reserva ya no está activa')
    }
    const already = this.state.bookings.some(
      (b) =>
        b.sessionId === newSessionId &&
        b.userId === userId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'waitlisted'),
    )
    if (already) throw new Error('Ya tienes reserva en esta sesión')
    if (hasOverlap(this.state.sessions, this.state.bookings, userId, next, old.id)) {
      throw new Error('Se solapa con otra reserva activa')
    }
    if (this.state.users.find((u) => u.id === userId)?.role === 'member') {
      const allowed = this.memberBookingAllowed(userId, next.zoneId)
      if (!allowed.ok) throw new Error(allowed.reason)
    }
    if (!canBookSession(next, this.state.bookings).ok) {
      throw new Error(RESCHEDULE_FULL_MESSAGE)
    }

    // Todo validado: recién ahora se mueve. No hay nada que deshacer.
    const now = new Date().toISOString()
    const wasConfirmed = old.status === 'confirmed'
    old.status = 'cancelled'
    old.cancelledAt = now
    this.state.waitlist = this.state.waitlist.filter(
      (w) => !(w.sessionId === old.sessionId && w.userId === userId),
    )
    const booking: Booking = {
      id: uid('bk'),
      sessionId: newSessionId,
      userId,
      status: 'confirmed',
      createdAt: now,
      cancelledAt: null,
      checkInCode: uid('QR').toUpperCase(),
    }
    this.state.bookings.push(booking)
    if (wasConfirmed) this.promoteFromWaitlist(old.sessionId)
    this.state.waitlist = reindexWaitlist(this.state.waitlist, old.sessionId)
    for (const session of this.state.sessions) {
      if (session.id === old.sessionId || session.id === newSessionId) {
        session.bookedCount = seatsTaken(this.state.bookings, session.id)
      }
    }
    this.persistState()
    return { ...booking }
  }

  async checkIn(bookingId: string, code: string): Promise<CheckIn> {
    const booking = this.state.bookings.find((b) => b.id === bookingId)
    if (!booking) throw new Error('Reserva no encontrada')
    if (booking.checkInCode !== code.trim().toUpperCase()) {
      throw new Error('Código QR inválido')
    }
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      throw new Error('La reserva no está activa')
    }
    const session = this.state.sessions.find((s) => s.id === booking.sessionId)
    if (!session) throw new Error('Sesión no encontrada')
    const windowMin = this.state.settings.checkInWindowMinutes
    if (!isCheckInWindow(session.startsAt, new Date(), windowMin, 10)) {
      throw new Error('Fuera de la ventana de check-in')
    }
    const checkIn: CheckIn = {
      id: uid('ci'),
      bookingId: booking.id,
      sessionId: session.id,
      userId: booking.userId,
      checkedInAt: new Date().toISOString(),
    }
    this.state.checkIns.push(checkIn)
    booking.status = 'attended'
    this.persistState()
    return { ...checkIn }
  }

  async listMeasurements(userId: string): Promise<BodyMeasurement[]> {
    return this.state.measurements
      .filter((m) => m.userId === userId)
      .map((m) => ({ ...m }))
      .sort(
        (a, b) =>
          new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime(),
      )
  }

  async createMeasurement(
    input: Omit<BodyMeasurement, 'id'>,
  ): Promise<BodyMeasurement> {
    const actor = await this.requireUser()
    if (!canManageWeight(actor.role, actor.id, input.userId)) {
      throw new Error('Sin permiso para registrar peso')
    }
    const targetUser = this.state.users.find((u) => u.id === input.userId)
    const effectiveHeight = input.heightCm ?? targetUser?.heightCm
    const computedBmi =
      input.bmi ?? (effectiveHeight ? calculateBmi(input.weightKg, effectiveHeight) ?? undefined : undefined)

    const row: BodyMeasurement = {
      ...input,
      heightCm: effectiveHeight,
      bmi: computedBmi,
      id: uid('meas'),
    }
    this.state.measurements.push(row)
    this.persistState()
    return { ...row }
  }

  async updateMeasurement(
    id: string,
    patch: Partial<Omit<BodyMeasurement, 'id' | 'userId' | 'recordedBy'>>,
  ): Promise<BodyMeasurement> {
    const actor = await this.requireUser()
    const row = this.state.measurements.find((m) => m.id === id)
    if (!row) throw new Error('Registro no encontrado')
    if (!canManageWeight(actor.role, actor.id, row.userId)) {
      throw new Error('Sin permiso')
    }
    Object.assign(row, patch)

    const targetUser = this.state.users.find((u) => u.id === row.userId)
    const effectiveHeight = row.heightCm ?? targetUser?.heightCm
    if (patch.weightKg !== undefined || patch.heightCm !== undefined) {
      row.heightCm = effectiveHeight
      row.bmi = calculateBmi(row.weightKg, effectiveHeight) ?? undefined
    }

    this.persistState()
    return { ...row }
  }

  async deleteMeasurement(id: string): Promise<void> {
    const actor = await this.requireUser()
    const row = this.state.measurements.find((m) => m.id === id)
    if (!row) throw new Error('Registro no encontrado')
    if (!canManageWeight(actor.role, actor.id, row.userId)) {
      throw new Error('Sin permiso')
    }
    this.state.measurements = this.state.measurements.filter((m) => m.id !== id)
    this.persistState()
  }

  async getBodyGoal(userId: string): Promise<BodyGoal | null> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, userId)) {
      throw new Error('Sin permiso para ver metas')
    }
    const goals = (this.state.bodyGoals ?? []).filter((g) => g.userId === userId)
    if (goals.length === 0) return null
    // Return active goal or latest
    const active = goals.find((g) => g.status === 'active')
    if (active) return { ...active }
    const last = goals[goals.length - 1]
    return last ? { ...last } : null
  }

  async listBodyGoals(userId: string): Promise<BodyGoal[]> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, userId)) {
      throw new Error('Sin permiso para ver metas')
    }
    return (this.state.bodyGoals ?? [])
      .filter((g) => g.userId === userId)
      .map((g) => ({ ...g }))
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? b.targetDate).getTime() -
          new Date(a.createdAt ?? a.targetDate).getTime(),
      )
  }

  async upsertBodyGoal(
    goal: Omit<BodyGoal, 'id' | 'createdAt'> & { id?: string },
  ): Promise<BodyGoal> {
    const actor = await this.requireUser()
    if (!canManageGoals(actor.role, actor.id, goal.userId)) {
      throw new Error('Sin permiso para modificar metas')
    }
    if (!this.state.bodyGoals) this.state.bodyGoals = []

    const targetUser = this.state.users.find((u) => u.id === goal.userId)
    const targetBmi =
      goal.targetBmi ??
      (targetUser?.heightCm
        ? calculateBmi(goal.targetWeightKg, targetUser.heightCm) ?? undefined
        : undefined)

    if (goal.id) {
      const idx = this.state.bodyGoals.findIndex((g) => g.id === goal.id)
      if (idx >= 0) {
        const updated: BodyGoal = {
          ...this.state.bodyGoals[idx],
          ...goal,
          targetBmi,
          id: goal.id,
        }
        this.state.bodyGoals[idx] = updated
        this.persistState()
        return { ...updated }
      }
    }

    // If new active goal, archive previous active goals
    if (goal.status === 'active') {
      for (const g of this.state.bodyGoals) {
        if (g.userId === goal.userId && g.status === 'active') {
          g.status = 'cancelled'
        }
      }
    }

    const newGoal: BodyGoal = {
      ...goal,
      id: goal.id ?? uid('goal'),
      targetBmi,
      createdAt: new Date().toISOString(),
    }
    this.state.bodyGoals.push(newGoal)
    this.persistState()
    return { ...newGoal }
  }

  async deleteBodyGoal(id: string): Promise<void> {
    const actor = await this.requireUser()
    const goal = (this.state.bodyGoals ?? []).find((g) => g.id === id)
    if (!goal) throw new Error('Meta no encontrada')
    if (!canManageGoals(actor.role, actor.id, goal.userId)) {
      throw new Error('Sin permiso')
    }
    this.state.bodyGoals = (this.state.bodyGoals ?? []).filter((g) => g.id !== id)
    this.persistState()
  }

  async listMembers(): Promise<User[]> {
    return this.state.users
      .filter((u) => u.role === 'member')
      .map((u) => ({ ...u }))
  }

  async getMembershipPlans(): Promise<MembershipPlan[]> {
    await this.ensureReady()
    const actor = this.currentUserId
      ? (this.state.users.find((u) => u.id === this.currentUserId) ?? null)
      : null
    if (actor && (actor.role === 'staff' || actor.role === 'admin')) {
      return (this.state.membershipPlans ?? []).map((p) => ({ ...p }))
    }
    return (this.state.membershipPlans ?? [])
      .filter((p) => p.active)
      .map((p) => ({ ...p }))
  }

  async upsertMembershipPlan(
    plan: Partial<MembershipPlan> & { name: string; priceCents: number; durationDays: number },
  ): Promise<MembershipPlan> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')
    if (actor.role !== 'admin') throw new Error('Solo admin')
    if (!this.state.membershipPlans) this.state.membershipPlans = []
    const existingIdx = plan.id
      ? this.state.membershipPlans.findIndex((p) => p.id === plan.id)
      : -1
    const existing = existingIdx >= 0 ? this.state.membershipPlans[existingIdx] : null
    const updated: MembershipPlan = {
      id: existing ? existing.id : (plan.id ?? uid('plan')),
      name: plan.name,
      priceCents: plan.priceCents,
      durationDays: plan.durationDays,
      visitQuota: plan.visitQuota !== undefined ? plan.visitQuota : (existing?.visitQuota ?? null),
      allowedZoneIds: plan.allowedZoneIds ?? existing?.allowedZoneIds ?? [],
      active: plan.active !== undefined ? plan.active : (existing?.active ?? true),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    if (existingIdx >= 0) {
      this.state.membershipPlans[existingIdx] = updated
    } else {
      this.state.membershipPlans.push(updated)
    }
    this.persistState()
    return { ...updated }
  }

  async deleteMembershipPlan(planId: string): Promise<void> {
    const actor = await this.requireUser()
    if (actor.role !== 'admin') throw new Error('Solo admin')
    this.state.membershipPlans = (this.state.membershipPlans ?? []).filter((p) => p.id !== planId)
    this.persistState()
  }

  async getMemberMembership(userId: string): Promise<Membership | null> {
    await this.ensureReady()
    const userMemberships = (this.state.memberships ?? []).filter((m) => m.userId === userId)
    if (userMemberships.length === 0) return null
    const active = userMemberships.find((m) => {
      const s = computeMembershipStatus(m)
      return s === 'active' || s === 'grace'
    })
    if (active) {
      return { ...active, status: computeMembershipStatus(active) }
    }
    const sorted = [...userMemberships].sort(
      (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
    )
    const latest = sorted[0]
    if (!latest) return null
    return { ...latest, status: computeMembershipStatus(latest) }
  }

  async getMemberPayments(userId: string): Promise<Payment[]> {
    await this.ensureReady()
    return (this.state.payments ?? [])
      .filter((p) => p.userId === userId)
      .map((p) => ({ ...p }))
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }

  async listMemberships(): Promise<Membership[]> {
    await this.ensureReady()
    const actor = this.currentUserId
      ? (this.state.users.find((u) => u.id === this.currentUserId) ?? null)
      : null
    let memberships = this.state.memberships ?? []
    if (actor && actor.role === 'member') {
      memberships = memberships.filter((m) => m.userId === actor.id)
    }
    return memberships.map((m) => ({
      ...m,
      status: computeMembershipStatus(m),
    }))
  }

  async listPayments(): Promise<Payment[]> {
    await this.ensureReady()
    const actor = this.currentUserId
      ? (this.state.users.find((u) => u.id === this.currentUserId) ?? null)
      : null
    let payments = this.state.payments ?? []
    if (actor && actor.role === 'member') {
      payments = payments.filter((p) => p.userId === actor.id)
    }
    return payments
      .map((p) => ({ ...p }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  async requestPlanPayment(params: {
    planId: string
    manualMethod: ManualPaymentMethod
  }): Promise<Payment> {
    const actor = await this.requireUser()
    if (actor.role !== 'member') {
      throw new Error('Solo un socio puede solicitar un plan')
    }
    const plan = (this.state.membershipPlans ?? []).find(
      (p) => p.id === params.planId && p.active,
    )
    if (!plan) throw new Error('Plan no encontrado')
    assertPlanSellableInApp(plan, this.state.settings)
    if (!this.state.payments) this.state.payments = []

    const existingIdx = this.state.payments.findIndex(
      (p) =>
        p.userId === actor.id &&
        p.status === 'pending' &&
        p.provider === 'manual' &&
        p.membershipId == null,
    )
    const existing = existingIdx >= 0 ? this.state.payments[existingIdx] : null
    const payment: Payment = {
      id: existing?.id ?? uid('pay'),
      userId: actor.id,
      planId: plan.id,
      membershipId: null,
      amountCents: plan.priceCents,
      status: 'pending',
      provider: 'manual',
      manualMethod: params.manualMethod,
      reference: null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      approvedAt: null,
    }
    if (existingIdx >= 0) {
      this.state.payments[existingIdx] = payment
    } else {
      this.state.payments.push(payment)
    }
    this.persistState()
    return { ...payment }
  }

  async registerManualPayment(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }): Promise<{ payment: Payment; membership: Membership }> {
    const actor = await this.requireUser()
    if (actor.role === 'member') throw new Error('Sin permiso')

    const plan = (this.state.membershipPlans ?? []).find((p) => p.id === params.planId)
    if (!plan) throw new Error('Plan no encontrado')

    const currentMembership = await this.getMemberMembership(params.userId)
    const newDates = extendMembership(currentMembership, plan, new Date())

    if (!this.state.memberships) this.state.memberships = []
    if (!this.state.payments) this.state.payments = []

    let membership: Membership
    const existingIdx = currentMembership
      ? this.state.memberships.findIndex((m) => m.id === currentMembership.id)
      : -1

    if (existingIdx >= 0) {
      const existing = this.state.memberships[existingIdx]!
      membership = {
        ...existing,
        planId: plan.id,
        startsAt: newDates.startsAt,
        endsAt: newDates.endsAt,
        graceEndsAt: newDates.graceEndsAt,
        status: newDates.status,
        visitsLeft: newDates.visitsLeft,
      }
      this.state.memberships[existingIdx] = membership
    } else {
      membership = {
        id: uid('mem'),
        userId: params.userId,
        planId: plan.id,
        startsAt: newDates.startsAt,
        endsAt: newDates.endsAt,
        graceEndsAt: newDates.graceEndsAt,
        status: newDates.status,
        visitsLeft: newDates.visitsLeft,
        createdAt: new Date().toISOString(),
      }
      this.state.memberships.push(membership)
    }

    const pendingIdx = this.state.payments.findIndex(
      (p) =>
        p.userId === params.userId &&
        p.status === 'pending' &&
        p.provider === 'manual' &&
        p.membershipId == null,
    )
    const pending = pendingIdx >= 0 ? this.state.payments[pendingIdx] : null
    const payment: Payment = {
      id: pending?.id ?? uid('pay'),
      userId: params.userId,
      planId: plan.id,
      membershipId: membership.id,
      amountCents: params.amountCents,
      status: 'approved',
      provider: 'manual',
      manualMethod: params.manualMethod,
      reference: params.reference ?? pending?.reference ?? null,
      createdAt: pending?.createdAt ?? new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    }
    if (pendingIdx >= 0) {
      this.state.payments[pendingIdx] = payment
    } else {
      this.state.payments.push(payment)
    }
    this.persistState()

    return {
      payment: { ...payment },
      membership: { ...membership },
    }
  }

  async createOnlineCheckout(_params: {
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
    throw new Error(
      'El pago en línea (Datafast) requiere el ambiente Supabase (QA). Usa recepción en modo local.',
    )
  }

  async verifyOnlinePayment(_params: {
    paymentId: string
    resourcePath: string
  }): Promise<{ ok: boolean; description?: string }> {
    throw new Error('Verificación Datafast solo en Supabase.')
  }

  async createPagomediosPayment(_params: {
    planId: string
    document: string
    documentType: PagomediosDocumentType
    phone: string
    address: string
    native?: boolean
  }): Promise<{ url: string; paymentId: string }> {
    throw new Error(
      'El pago en línea (Pagomedios) requiere el ambiente Supabase (QA). Usa recepción en modo local.',
    )
  }

  async verifyPagomediosPayment(_params: { paymentId: string }): Promise<OnlinePaymentResult> {
    throw new Error('Verificación Pagomedios solo en Supabase.')
  }
}
