import type {
  BodyGoal,
  BodyMeasurement,
  Booking,
  CheckIn,
  ClassTemplate,
  GymSettings,
  GymState,
  LegalConsentContext,
  LegalConsentInput,
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
  /** Documentos aceptados en el registro; la base los guarda al crear la cuenta. */
  consents?: LegalConsentInput[]
}

export interface GymRepository {
  load(): Promise<GymState>
  getCurrentUser(): Promise<User | null>
  signIn(creds: AuthCredentials): Promise<User>
  signUp(creds: AuthCredentials): Promise<User>
  signOut(): Promise<void>
  /** Guarda la aceptación de documentos legales del usuario con sesión (fecha del servidor). */
  recordLegalConsents?(context: LegalConsentContext, consents: LegalConsentInput[]): Promise<void>
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
  /**
   * Confirma la cuenta nueva con el código del correo y deja la sesión abierta.
   * Solo Supabase: el modo demo crea la cuenta ya confirmada.
   */
  confirmSignUp?(email: string, code: string): Promise<User>
  /** Reenvía el código de confirmación de la cuenta nueva. */
  resendSignUpCode?(email: string): Promise<void>
  /** Fija una contraseña nueva para la sesión activa (cambio con sesión iniciada). */
  updatePassword(newPassword: string): Promise<void>
  deleteAccount(): Promise<void>
  updateProfile?(patch: Partial<Omit<User, 'id' | 'email' | 'role' | 'createdAt'>>): Promise<User>

  updateSettings(patch: Partial<GymSettings>): Promise<GymSettings>
  publishTermsPdf?(file: File, version: string): Promise<GymSettings>

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
  /** `reference`: la que el socio vio en el checkout (ZC-XXXXXX); si ya tenía una, se conserva. */
  requestPlanPayment(params: {
    planId: string
    manualMethod: ManualPaymentMethod
    reference?: string
    /** Versión de los términos que el socio aceptó (queda guardada con la solicitud). */
    termsVersion: string
  }): Promise<Payment>
  registerManualPayment(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
    reference?: string
  }): Promise<{ payment: Payment; membership: Membership }>
  /**
   * Recepción: cierra hoy el plan vigente y abre `planId` con período completo desde ahora.
   * El cobro descuenta el crédito por días no usados (queda en las notas del pago).
   */
  changePlanNow?(params: {
    userId: string
    planId: string
    amountCents: number
    manualMethod: ManualPaymentMethod
  }): Promise<{ payment: Payment; membership: Membership }>
  /** Recepción: descarta una solicitud manual pendiente (queda `rejected`; el socio ve el aviso). */
  discardPlanRequest?(paymentId: string): Promise<Payment>
  /** Recepción: marca un pago aprobado como reembolsado y, si se pide, cancela su membresía. */
  refundPayment?(params: { paymentId: string; cancelMembership: boolean }): Promise<Payment>
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
    /** Versión de los términos que el socio aceptó (la Edge Function la exige). */
    termsVersion: string
    /** App nativa: el retorno muestra "cierra esta ventana" en vez de volver a la web. */
    native?: boolean
    /**
     * Pago recurrente mensual: el socio registra su tarjeta en Pagomedios y, al
     * verificar, se cobra el primer mes. Los siguientes los cobra el gimnasio.
     */
    recurring?: boolean
  }): Promise<{ url: string; paymentId: string }>
  /** Consulta el estado en Pagomedios y activa la membresía si está autorizado. */
  verifyPagomediosPayment?(params: { paymentId: string }): Promise<OnlinePaymentResult>
}

/** Comprobante de un pago en línea aprobado. */
export interface OnlinePaymentReceipt {
  /** Número de comprobante corto (ZCAPP-77). */
  receiptNumber?: number | null
  planName: string | null
  amountCents: number
  authorizationCode: string | null
  /** Inicio de la fila comprada (futuro si quedó en espera). */
  membershipStartsAt?: string | null
  membershipEndsAt: string | null
  /** Pago recurrente: la tarjeta quedó registrada para los cobros siguientes. */
  recurring?: boolean
}

export interface OnlinePaymentResult {
  status: 'approved' | 'pending' | 'rejected'
  description?: string
  receipt?: OnlinePaymentReceipt
}

/** 05 cédula, 04 RUC, 06 pasaporte, 08 identificación del exterior */
export type PagomediosDocumentType = '04' | '05' | '06' | '08'
