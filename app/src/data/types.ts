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
} from '@/domain/models'

export type AuthCredentials = {
  email: string
  password: string
  fullName?: string
  birthDate?: string
  residence?: string
  heightCm?: number
  initialWeightKg?: number
  goals?: string
  healthNotes?: string
}

export interface GymRepository {
  load(): Promise<GymState>
  getCurrentUser(): Promise<User | null>
  signIn(creds: AuthCredentials): Promise<User>
  signUp(creds: AuthCredentials): Promise<User>
  signOut(): Promise<void>
  /** Envía el correo con el enlace de recuperación. */
  resetPassword(email: string): Promise<void>
  /**
   * Fija una contraseña nueva para la sesión activa.
   * Se usa tanto al volver del enlace de recuperación (Supabase abre una
   * sesión temporal al validar el token) como al cambiarla desde el perfil.
   */
  updatePassword(newPassword: string): Promise<void>
  /** True si hay una sesión abierta por un enlace de recuperación. */
  hasRecoverySession?(): Promise<boolean>
  deleteAccount(): Promise<void>
  updateProfile?(patch: Partial<Omit<User, 'id' | 'email' | 'role' | 'createdAt'>>): Promise<User>

  updateSettings(patch: Partial<GymSettings>): Promise<GymSettings>

  listZones(): Promise<Zone[]>
  upsertZone(zone: Zone): Promise<Zone>
  deleteZone(id: string): Promise<void>

  listTemplates(): Promise<ClassTemplate[]>
  upsertTemplate(template: ClassTemplate): Promise<ClassTemplate>
  deleteTemplate(id: string): Promise<void>

  listSessions(fromIso?: string, toIso?: string): Promise<Session[]>
  upsertSession(session: Session): Promise<Session>
  deleteSession(id: string): Promise<void>

  listBookingsForUser(userId: string): Promise<Booking[]>
  createBooking(
    sessionId: string,
    userId: string,
  ): Promise<Booking | WaitlistEntry>
  cancelBooking(bookingId: string): Promise<Booking>
  rescheduleBooking(bookingId: string, newSessionId: string): Promise<Booking>
  checkIn(bookingId: string, code: string): Promise<CheckIn>

  listMeasurements(userId: string): Promise<BodyMeasurement[]>
  createMeasurement(
    input: Omit<BodyMeasurement, 'id'>,
  ): Promise<BodyMeasurement>
  updateMeasurement(
    id: string,
    patch: Partial<Omit<BodyMeasurement, 'id' | 'userId' | 'recordedBy'>>,
  ): Promise<BodyMeasurement>
  deleteMeasurement(id: string): Promise<void>

  getBodyGoal(userId: string): Promise<BodyGoal | null>
  listBodyGoals?(userId: string): Promise<BodyGoal[]>
  upsertBodyGoal(
    goal: Omit<BodyGoal, 'id' | 'createdAt'> & { id?: string },
  ): Promise<BodyGoal>
  deleteBodyGoal?(id: string): Promise<void>

  listMembers(): Promise<User[]>

  getMembershipPlans(): Promise<MembershipPlan[]>
  upsertMembershipPlan(plan: Partial<MembershipPlan> & { name: string; priceCents: number; durationDays: number }): Promise<MembershipPlan>
  deleteMembershipPlan(planId: string): Promise<void>
  getMemberMembership(userId: string): Promise<Membership | null>
  getMemberPayments(userId: string): Promise<Payment[]>
  listMemberships(): Promise<Membership[]>
  listPayments(): Promise<Payment[]>
  registerManualPayment(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }): Promise<{ payment: Payment; membership: Membership }>
  /**
   * Inicia checkout online (Datafast Dataweb / COPYandPay).
   * Solo disponible con Supabase + Edge Function configurada.
   */
  createOnlineCheckout?(params: {
    planId: string
    phone: string
    identification: string
    street?: string
  }): Promise<{
    checkoutId: string
    paymentId: string
    widgetScriptUrl: string
    shopperResultUrl: string
  }>
  /** Confirma pago Datafast con resourcePath del redirect. */
  verifyOnlinePayment?(params: {
    paymentId: string
    resourcePath: string
  }): Promise<{ ok: boolean; description?: string }>
}
