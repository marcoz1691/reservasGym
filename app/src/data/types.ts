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
  /** Guarda la sesión actual para volver a entrar con Face ID o huella. */
  rememberBiometricSession?(): Promise<void>
  /** Abre la sesión guardada. Falla si venció o no existe. */
  restoreBiometricSession?(): Promise<User>
  /**
   * Envía al correo el código de recuperación. Resuelve igual si la cuenta no
   * existe, para no revelar qué correos están registrados.
   */
  resetPassword(email: string): Promise<void>
  /**
   * Valida el código del correo y fija la contraseña nueva. Deja la sesión
   * cerrada: el socio entra luego desde el login con la clave nueva.
   */
  completePasswordReset(email: string, code: string, newPassword: string): Promise<void>
  /** Fija una contraseña nueva para la sesión activa (cambio con sesión iniciada). */
  updatePassword(newPassword: string): Promise<void>
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
  requestPlanPayment(params: {
    planId: string
    manualMethod: ManualPaymentMethod
  }): Promise<Payment>
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
  /**
   * Crea una solicitud de pago único en Pagomedios y devuelve la URL a la que
   * se redirige al socio. Solo con Supabase + Edge Function pagomedios-payment.
   */
  createPagomediosPayment?(params: {
    planId: string
    document: string
    documentType: PagomediosDocumentType
    phone: string
    address: string
    /** App nativa: el retorno muestra "cierra esta ventana" en vez de volver a la web. */
    native?: boolean
  }): Promise<{ url: string; paymentId: string }>
  /** Consulta el estado en Pagomedios y activa la membresía si está autorizado. */
  verifyPagomediosPayment?(params: {
    paymentId: string
  }): Promise<{ status: 'approved' | 'pending' | 'rejected'; description?: string }>
}

/** 05 cédula, 04 RUC, 06 pasaporte, 08 identificación del exterior */
export type PagomediosDocumentType = '04' | '05' | '06' | '08'
