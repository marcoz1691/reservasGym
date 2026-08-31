import { addDays, addHours, setHours, setMinutes, startOfDay } from 'date-fns'
import type {
  BodyGoal,
  BodyMeasurement,
  ClassTemplate,
  GymSettings,
  GymState,
  Membership,
  MembershipPlan,
  Payment,
  Session,
  Trainer,
  User,
  Zone,
} from '@/domain/models'
import { createId } from '@/lib/id'

export const DEFAULT_SETTINGS: GymSettings = {
  name: 'Zona Cero',
  logoUrl: null,
  primaryColor: '#0E1117',
  accentColor: '#FF6146',
  bookingWindowHours: 72,
  cancelWindowHours: 2,
  checkInWindowMinutes: 20,
}

/** Demo password for LocalRepository seed users (dev only). */
export const DEMO_PASSWORD = 'demo1234'

function atHour(base: Date, dayOffset: number, hour: number, minute = 0): Date {
  const d = addDays(startOfDay(base), dayOffset)
  return setMinutes(setHours(d, hour), minute)
}

export function createSeedState(now = new Date()): GymState {
  const settings: GymSettings = { ...DEFAULT_SETTINGS }

  const users: User[] = [
    {
      id: 'user_member',
      email: 'socio@gym.local',
      fullName: 'Ana Socio',
      role: 'member',
      createdAt: now.toISOString(),
      birthDate: '1995-04-12',
      residence: 'Quito, Cumbayá',
      heightCm: 165,
      initialWeightKg: 68.4,
      goals: 'Acondicionamiento físico y tonificación muscular',
      healthNotes: 'Ninguna dolencia previa',
    },
    {
      id: 'user_member_2',
      email: 'luis@gym.local',
      fullName: 'Luis Pérez',
      role: 'member',
      createdAt: now.toISOString(),
    },
    {
      id: 'user_staff',
      email: 'staff@gym.local',
      fullName: 'Carlos Staff',
      role: 'staff',
      createdAt: now.toISOString(),
    },
    {
      id: 'user_admin',
      email: 'admin@gym.local',
      fullName: 'María Admin',
      role: 'admin',
      createdAt: now.toISOString(),
    },
  ]

  const trainers: Trainer[] = [
    {
      id: 'tr_1',
      fullName: 'Diego Coach',
      specialties: ['crossfit', 'hyrox', 'musculacion'],
    },
    {
      id: 'tr_2',
      fullName: 'Valentina Fisio',
      specialties: ['fisioterapia', 'nutricion'],
    },
    {
      id: 'tr_3',
      fullName: 'Sofía Ritmo',
      specialties: ['bailoterapia', 'comunes'],
    },
  ]

  const zones: Zone[] = [
    {
      id: 'zone_gimnasio',
      name: 'Gimnasio',
      type: 'gimnasio',
      description: 'Áreas con mayor seguimiento y reserva general.',
      defaultCapacity: 30,
      imageHint: 'floor',
    },
    {
      id: 'zone_fisio',
      name: 'Fisioterapia',
      type: 'fisioterapia',
      description: 'Consultas y sesiones de rehabilitación.',
      defaultCapacity: 2,
      imageHint: 'physio',
    },
    {
      id: 'zone_nutri',
      name: 'Nutrición',
      type: 'nutricion',
      description: 'Asesorías y seguimiento nutricional.',
      defaultCapacity: 2,
      imageHint: 'nutrition',
    },
    {
      id: 'zone_bailo',
      name: 'Bailoterapia',
      type: 'bailoterapia',
      description: 'Clases grupales de baile terapéutico.',
      defaultCapacity: 20,
      imageHint: 'dance',
    },
    {
      id: 'zone_comunes',
      name: 'Áreas comunes',
      type: 'comunes',
      description: 'Espacios compartidos y franjas abiertas.',
      defaultCapacity: 15,
      imageHint: 'common',
    },
    {
      id: 'zone_hyrox',
      name: 'Hyrox',
      type: 'hyrox',
      description: 'Clases y preparación Hyrox.',
      defaultCapacity: 16,
      imageHint: 'hyrox',
    },
    {
      id: 'zone_muscu',
      name: 'Musculación',
      type: 'musculacion',
      description: 'Sala de pesas y fuerza.',
      defaultCapacity: 25,
      imageHint: 'weights',
    },
    {
      id: 'zone_cross',
      name: 'CrossFit',
      type: 'crossfit',
      description: 'Clases y preparación CrossFit.',
      defaultCapacity: 18,
      imageHint: 'crossfit',
    },
    {
      id: 'zone-dragon-fit',
      name: 'Dragon Fit',
      type: 'dragon_fit',
      description: 'Clases y entrenamiento funcional de alta intensidad Dragon Fit.',
      defaultCapacity: 20,
      imageHint: 'dragon-fit',
    },
  ]

  const templates: ClassTemplate[] = [
    {
      id: 'tpl_gym_open',
      zoneId: 'zone_gimnasio',
      title: 'Acceso gimnasio',
      kind: 'open',
      durationMinutes: 90,
      capacity: 30,
      trainerId: null,
    },
    {
      id: 'tpl_fisio',
      zoneId: 'zone_fisio',
      title: 'Sesión fisioterapia',
      kind: 'class',
      durationMinutes: 45,
      capacity: 2,
      trainerId: 'tr_2',
    },
    {
      id: 'tpl_nutri',
      zoneId: 'zone_nutri',
      title: 'Consulta nutrición',
      kind: 'class',
      durationMinutes: 40,
      capacity: 2,
      trainerId: 'tr_2',
    },
    {
      id: 'tpl_bailo',
      zoneId: 'zone_bailo',
      title: 'Bailoterapia',
      kind: 'class',
      durationMinutes: 55,
      capacity: 20,
      trainerId: 'tr_3',
    },
    {
      id: 'tpl_comunes',
      zoneId: 'zone_comunes',
      title: 'Área común',
      kind: 'open',
      durationMinutes: 60,
      capacity: 15,
      trainerId: null,
    },
    {
      id: 'tpl_hyrox_class',
      zoneId: 'zone_hyrox',
      title: 'Hyrox · clase',
      kind: 'class',
      durationMinutes: 60,
      capacity: 16,
      trainerId: 'tr_1',
    },
    {
      id: 'tpl_hyrox_prep',
      zoneId: 'zone_hyrox',
      title: 'Hyrox · preparación',
      kind: 'preparation',
      durationMinutes: 45,
      capacity: 12,
      trainerId: 'tr_1',
    },
    {
      id: 'tpl_muscu',
      zoneId: 'zone_muscu',
      title: 'Musculación',
      kind: 'open',
      durationMinutes: 90,
      capacity: 25,
      trainerId: null,
    },
    {
      id: 'tpl_cf_class',
      zoneId: 'zone_cross',
      title: 'CrossFit · clase',
      kind: 'class',
      durationMinutes: 60,
      capacity: 18,
      trainerId: 'tr_1',
    },
    {
      id: 'tpl_cf_prep',
      zoneId: 'zone_cross',
      title: 'CrossFit · preparación',
      kind: 'preparation',
      durationMinutes: 45,
      capacity: 12,
      trainerId: 'tr_1',
    },
    {
      id: 'tpl_dragon_fit',
      zoneId: 'zone-dragon-fit',
      title: 'Dragon Fit — sesión grupal',
      kind: 'class',
      durationMinutes: 50,
      capacity: 20,
      trainerId: 'tr_1',
    },
  ]

  const schedule: Array<{ tpl: string; day: number; hour: number }> = [
    { tpl: 'tpl_gym_open', day: 0, hour: 7 },
    { tpl: 'tpl_gym_open', day: 0, hour: 18 },
    { tpl: 'tpl_fisio', day: 0, hour: 10 },
    { tpl: 'tpl_nutri', day: 1, hour: 9 },
    { tpl: 'tpl_bailo', day: 1, hour: 19 },
    { tpl: 'tpl_comunes', day: 2, hour: 12 },
    { tpl: 'tpl_hyrox_class', day: 0, hour: 6 },
    { tpl: 'tpl_hyrox_prep', day: 2, hour: 17 },
    { tpl: 'tpl_muscu', day: 1, hour: 8 },
    { tpl: 'tpl_cf_class', day: 0, hour: 19 },
    { tpl: 'tpl_cf_prep', day: 3, hour: 7 },
    { tpl: 'tpl_cf_class', day: 4, hour: 19 },
    { tpl: 'tpl_bailo', day: 3, hour: 18 },
    { tpl: 'tpl_fisio', day: 4, hour: 11 },
    { tpl: 'tpl_dragon_fit', day: 0, hour: 17 },
    { tpl: 'tpl_dragon_fit', day: 2, hour: 19 },
    { tpl: 'tpl_dragon_fit', day: 4, hour: 18 },
  ]

  const tplById = new Map(templates.map((t) => [t.id, t]))
  const sessions: Session[] = []

  for (let week = 0; week < 2; week++) {
    for (const slot of schedule) {
      const tpl = tplById.get(slot.tpl)
      if (!tpl) continue
      const start = atHour(now, week * 7 + slot.day, slot.hour)
      const end = addHours(start, tpl.durationMinutes / 60)
      sessions.push({
        id: createId('ses'),
        templateId: tpl.id,
        zoneId: tpl.zoneId,
        title: tpl.title,
        kind: tpl.kind,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        capacity: tpl.capacity,
        trainerId: tpl.trainerId,
        bookedCount: 0,
      })
    }
  }

  const measurements: BodyMeasurement[] = [
    {
      id: 'bm_1',
      userId: 'user_member',
      recordedBy: 'user_member',
      weightKg: 68.4,
      heightCm: 165,
      bmi: 25.1,
      waistCm: 76,
      hipCm: 98,
      chestCm: 92,
      armCm: 28,
      thighCm: 56,
      measuredAt: addDays(now, -14).toISOString(),
      notes: 'Inicio de seguimiento y evaluación inicial',
    },
    {
      id: 'bm_2',
      userId: 'user_member',
      recordedBy: 'user_staff',
      weightKg: 67.9,
      heightCm: 165,
      bmi: 24.9,
      waistCm: 75.5,
      hipCm: 97.5,
      chestCm: 91.5,
      armCm: 28.2,
      thighCm: 55.5,
      measuredAt: addDays(now, -7).toISOString(),
      notes: 'Control semanal con entrenador',
    },
    {
      id: 'bm_3',
      userId: 'user_member',
      recordedBy: 'user_member',
      weightKg: 67.2,
      heightCm: 165,
      bmi: 24.7,
      waistCm: 74.8,
      hipCm: 97.0,
      chestCm: 91.0,
      armCm: 28.5,
      thighCm: 55.0,
      measuredAt: addDays(now, -1).toISOString(),
      notes: 'Buena adherencia al entrenamiento de fuerza',
    },
  ]

  const bodyGoals: BodyGoal[] = [
    {
      id: 'bg_1',
      userId: 'user_member',
      targetWeightKg: 64.0,
      targetBmi: 23.5,
      targetDate: addDays(now, 45).toISOString().slice(0, 10),
      status: 'active',
      createdAt: addDays(now, -14).toISOString(),
    },
  ]

  const membershipPlans: MembershipPlan[] = [
    {
      id: 'plan-mensual-full',
      name: 'Plan Mensual Ilimitado',
      priceCents: 4500,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
      createdAt: now.toISOString(),
    },
    {
      id: 'plan-trimestral',
      name: 'Plan Trimestral',
      priceCents: 12000,
      durationDays: 90,
      visitQuota: null,
      allowedZoneIds: [],
      active: true,
      createdAt: now.toISOString(),
    },
    {
      id: 'plan-10-visitas',
      name: 'Pase 10 Visitas',
      priceCents: 3500,
      durationDays: 60,
      visitQuota: 10,
      allowedZoneIds: [],
      active: true,
      createdAt: now.toISOString(),
    },
    {
      id: 'plan-dragon-fit',
      name: 'Dragon Fit Mensual',
      priceCents: 5000,
      durationDays: 30,
      visitQuota: null,
      allowedZoneIds: ['zone-dragon-fit', 'zone-gimnasio', 'zone-muscu'],
      active: true,
      createdAt: now.toISOString(),
    },
  ]

  const memberships: Membership[] = [
    {
      id: 'mem_demo_1',
      userId: 'user_member',
      planId: 'plan-mensual-full',
      status: 'active',
      startsAt: addDays(now, -10).toISOString(),
      endsAt: addDays(now, 20).toISOString(),
      graceEndsAt: addDays(now, 23).toISOString(),
      visitsLeft: null,
      createdAt: addDays(now, -10).toISOString(),
    },
  ]

  const payments: Payment[] = [
    {
      id: 'pay_demo_1',
      userId: 'user_member',
      planId: 'plan-mensual-full',
      membershipId: 'mem_demo_1',
      amountCents: 4500,
      status: 'approved',
      provider: 'manual',
      manualMethod: 'transfer',
      reference: 'TRANSF-00129',
      createdAt: addDays(now, -10).toISOString(),
      approvedAt: addDays(now, -10).toISOString(),
    },
  ]

  return {
    settings,
    users,
    trainers,
    zones,
    templates,
    sessions,
    bookings: [],
    waitlist: [],
    checkIns: [],
    measurements,
    bodyGoals,
    membershipPlans,
    memberships,
    payments,
  }
}

