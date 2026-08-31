/** Domain models — Intermedia package */

export type UserRole = 'member' | 'staff' | 'admin'

export type ZoneType =
  | 'gimnasio'
  | 'fisioterapia'
  | 'nutricion'
  | 'bailoterapia'
  | 'comunes'
  | 'hyrox'
  | 'musculacion'
  | 'crossfit'
  | 'dragon_fit'

export type MembershipStatus = 'active' | 'grace' | 'expired' | 'cancelled'
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded'
export type PaymentProvider = 'manual' | 'datafast' | 'mercadopago'
export type ManualPaymentMethod = 'cash' | 'transfer' | 'card_pos'

export interface MembershipPlan {
  id: string
  name: string
  priceCents: number
  durationDays: number
  visitQuota: number | null
  allowedZoneIds: string[]
  active: boolean
  createdAt?: string
}

export interface Membership {
  id: string
  userId: string
  planId: string
  status: MembershipStatus
  startsAt: string
  endsAt: string
  visitsLeft: number | null
  graceEndsAt: string | null
  createdAt?: string
}

export interface Payment {
  id: string
  userId: string
  planId: string
  membershipId: string | null
  amountCents: number
  status: PaymentStatus
  provider: PaymentProvider
  manualMethod: ManualPaymentMethod | null
  reference?: string | null
  createdAt: string
  approvedAt: string | null
}

export type BookingStatus =
  | 'confirmed'
  | 'pending'
  | 'cancelled'
  | 'attended'
  | 'no_show'
  | 'waitlisted'

export type SessionKind = 'class' | 'preparation' | 'open'

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  createdAt: string
  birthDate?: string
  residence?: string
  heightCm?: number
  initialWeightKg?: number
  goals?: string
  healthNotes?: string
}

export interface Trainer {
  id: string
  fullName: string
  specialties: ZoneType[]
}

export interface Zone {
  id: string
  name: string
  type: ZoneType
  description: string
  defaultCapacity: number
  imageHint: string
}

export interface ClassTemplate {
  id: string
  zoneId: string
  title: string
  kind: SessionKind
  durationMinutes: number
  capacity: number
  trainerId: string | null
}

export interface Session {
  id: string
  templateId: string
  zoneId: string
  title: string
  kind: SessionKind
  startsAt: string
  endsAt: string
  capacity: number
  trainerId: string | null
  bookedCount: number
}

export interface Booking {
  id: string
  sessionId: string
  userId: string
  status: BookingStatus
  createdAt: string
  cancelledAt: string | null
  checkInCode: string
}

export interface WaitlistEntry {
  id: string
  sessionId: string
  userId: string
  position: number
  createdAt: string
}

export interface CheckIn {
  id: string
  bookingId: string
  sessionId: string
  userId: string
  checkedInAt: string
}

export interface BodyMeasurement {
  id: string
  userId: string
  recordedBy: string
  weightKg: number
  heightCm?: number
  bmi?: number
  waistCm?: number
  hipCm?: number
  chestCm?: number
  armCm?: number
  thighCm?: number
  measuredAt: string
  notes: string
}

export type BodyGoalStatus = 'active' | 'achieved' | 'cancelled'

export interface BodyGoal {
  id: string
  userId: string
  targetWeightKg: number
  targetBmi?: number
  targetDate: string
  status: BodyGoalStatus
  createdAt?: string
}

export interface GymSettings {
  name: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
  bookingWindowHours: number
  cancelWindowHours: number
  checkInWindowMinutes: number
}

export interface GymState {
  settings: GymSettings
  users: User[]
  trainers: Trainer[]
  zones: Zone[]
  templates: ClassTemplate[]
  sessions: Session[]
  bookings: Booking[]
  waitlist: WaitlistEntry[]
  checkIns: CheckIn[]
  measurements: BodyMeasurement[]
  bodyGoals?: BodyGoal[]
  membershipPlans: MembershipPlan[]
  memberships: Membership[]
  payments: Payment[]
}

export const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  gimnasio: 'Gimnasio',
  fisioterapia: 'Fisioterapia',
  nutricion: 'Nutrición',
  bailoterapia: 'Bailoterapia',
  comunes: 'Áreas comunes',
  hyrox: 'Hyrox',
  musculacion: 'Musculación',
  crossfit: 'CrossFit',
  dragon_fit: 'Dragon Fit',
}

export const ZONE_LABELS = ZONE_TYPE_LABELS


export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'confirmed',
  'pending',
  'attended',
  'waitlisted',
]
