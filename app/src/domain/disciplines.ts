import type { ZoneType } from './models'
import {
  Activity,
  Apple,
  Building2,
  Dumbbell,
  Flame,
  HeartPulse,
  Music,
  Timer,
  Zap,
} from 'lucide-react'
import type { ElementType } from 'react'

export interface DisciplineMeta {
  type: ZoneType
  name: string
  shortName: string
  icon: ElementType
  tone: 'ok' | 'warn' | 'neutral' | 'danger'
  colorClass: string
  bgLightClass: string
  badgeClass: string
  description: string
  defaultZoneId: string
}

export const ZONA_CERO_DISCIPLINES: Record<ZoneType, DisciplineMeta> = {
  gimnasio: {
    type: 'gimnasio',
    name: 'Gimnasio',
    shortName: 'Gym',
    icon: Dumbbell,
    tone: 'ok',
    colorClass: 'text-emerald-400',
    bgLightClass: 'bg-emerald-500/15',
    badgeClass: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
    description: 'Área general con mayor seguimiento y reserva libre',
    defaultZoneId: 'zone-gimnasio',
  },
  fisioterapia: {
    type: 'fisioterapia',
    name: 'Fisioterapia',
    shortName: 'Fisio',
    icon: HeartPulse,
    tone: 'ok',
    colorClass: 'text-cyan-400',
    bgLightClass: 'bg-cyan-500/15',
    badgeClass: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
    description: 'Consultas, terapias y rehabilitación deportiva especializada',
    defaultZoneId: 'zone-fisio',
  },
  nutricion: {
    type: 'nutricion',
    name: 'Nutrición',
    shortName: 'Nutri',
    icon: Apple,
    tone: 'ok',
    colorClass: 'text-lime-400',
    bgLightClass: 'bg-lime-500/15',
    badgeClass: 'border-lime-500/30 text-lime-300 bg-lime-500/10',
    description: 'Citas y asesorías personalizadas de nutrición deportiva',
    defaultZoneId: 'zone-nutri',
  },
  bailoterapia: {
    type: 'bailoterapia',
    name: 'Bailoterapia',
    shortName: 'Bailo',
    icon: Music,
    tone: 'warn',
    colorClass: 'text-pink-400',
    bgLightClass: 'bg-pink-500/15',
    badgeClass: 'border-pink-500/30 text-pink-300 bg-pink-500/10',
    description: 'Clases grupales de baile terapéutico y cardiovascular',
    defaultZoneId: 'zone-bailo',
  },
  dragon_fit: {
    type: 'dragon_fit',
    name: 'Dragon Fit',
    shortName: 'Dragon Fit',
    icon: Flame,
    tone: 'warn',
    colorClass: 'text-orange-400',
    bgLightClass: 'bg-orange-500/15',
    badgeClass: 'border-orange-500/30 text-orange-300 bg-orange-500/10',
    description: 'Entrenamiento funcional de alta intensidad Dragon Fit',
    defaultZoneId: 'zone-dragon-fit',
  },
  comunes: {
    type: 'comunes',
    name: 'Áreas comunes',
    shortName: 'Comunes',
    icon: Building2,
    tone: 'neutral',
    colorClass: 'text-slate-400',
    bgLightClass: 'bg-slate-500/15',
    badgeClass: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
    description: 'Sauna, duchas, vestidores y espacios compartidos',
    defaultZoneId: 'zone-comunes',
  },
  hyrox: {
    type: 'hyrox',
    name: 'Hyrox',
    shortName: 'Hyrox',
    icon: Timer,
    tone: 'warn',
    colorClass: 'text-amber-400',
    bgLightClass: 'bg-amber-500/15',
    badgeClass: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
    description: 'Clases oficiales y preparación para competencia Hyrox',
    defaultZoneId: 'zone-hyrox',
  },
  musculacion: {
    type: 'musculacion',
    name: 'Musculación',
    shortName: 'Musculación',
    icon: Activity,
    tone: 'ok',
    colorClass: 'text-teal-400',
    bgLightClass: 'bg-teal-500/15',
    badgeClass: 'border-teal-500/30 text-teal-300 bg-teal-500/10',
    description: 'Sala de pesas, barras, mancuernas y máquinas de fuerza',
    defaultZoneId: 'zone-muscu',
  },
  crossfit: {
    type: 'crossfit',
    name: 'CrossFit',
    shortName: 'CrossFit',
    icon: Zap,
    tone: 'danger',
    colorClass: 'text-red-400',
    bgLightClass: 'bg-red-500/15',
    badgeClass: 'border-red-500/30 text-red-300 bg-red-500/10',
    description: 'WODs de CrossFit, acondicionamiento y fuerza metabólica',
    defaultZoneId: 'zone-crossfit',
  },
}

export function getDisciplineMeta(zoneTypeOrId: string): DisciplineMeta {
  const normalized = zoneTypeOrId.toLowerCase().replace(/^zone[-_]/, '')
  if (normalized in ZONA_CERO_DISCIPLINES) {
    return ZONA_CERO_DISCIPLINES[normalized as ZoneType]
  }
  if (normalized.includes('dragon')) return ZONA_CERO_DISCIPLINES.dragon_fit
  if (normalized.includes('fisio')) return ZONA_CERO_DISCIPLINES.fisioterapia
  if (normalized.includes('nutri')) return ZONA_CERO_DISCIPLINES.nutricion
  if (normalized.includes('bailo')) return ZONA_CERO_DISCIPLINES.bailoterapia
  if (normalized.includes('cross')) return ZONA_CERO_DISCIPLINES.crossfit
  if (normalized.includes('muscu')) return ZONA_CERO_DISCIPLINES.musculacion
  if (normalized.includes('hyrox')) return ZONA_CERO_DISCIPLINES.hyrox
  if (normalized.includes('comun')) return ZONA_CERO_DISCIPLINES.comunes
  if (normalized.includes('gim') || normalized.includes('gym')) return ZONA_CERO_DISCIPLINES.gimnasio

  // Fallback
  return {
    type: 'gimnasio',
    name: zoneTypeOrId,
    shortName: zoneTypeOrId,
    icon: Activity,
    tone: 'neutral',
    colorClass: 'text-acc',
    bgLightClass: 'bg-acc/15',
    badgeClass: 'border-acc/30 text-acc bg-acc/10',
    description: '',
    defaultZoneId: zoneTypeOrId,
  }
}
