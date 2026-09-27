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
} from 'lucide-react'
import type { ElementType } from 'react'
import { Barbell } from '@/ui/icons'

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
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Área general con mayor seguimiento y reserva libre',
    defaultZoneId: 'zone-gimnasio',
  },
  fisioterapia: {
    type: 'fisioterapia',
    name: 'Fisioterapia',
    shortName: 'Fisio',
    icon: HeartPulse,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Consultas, terapias y rehabilitación deportiva especializada',
    defaultZoneId: 'zone-fisio',
  },
  nutricion: {
    type: 'nutricion',
    name: 'Nutrición',
    shortName: 'Nutri',
    icon: Apple,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Citas y asesorías personalizadas de nutrición deportiva',
    defaultZoneId: 'zone-nutri',
  },
  bailoterapia: {
    type: 'bailoterapia',
    name: 'Bailoterapia',
    shortName: 'Bailo',
    icon: Music,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Clases grupales de baile terapéutico y cardiovascular',
    defaultZoneId: 'zone-bailo',
  },
  dragon_fit: {
    type: 'dragon_fit',
    name: 'Dragon Fit',
    shortName: 'Dragon Fit',
    icon: Flame,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Entrenamiento funcional de alta intensidad Dragon Fit',
    defaultZoneId: 'zone-dragon-fit',
  },
  comunes: {
    type: 'comunes',
    name: 'Áreas comunes',
    shortName: 'Comunes',
    icon: Building2,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Sauna, duchas, vestidores y espacios compartidos',
    defaultZoneId: 'zone-comunes',
  },
  hyrox: {
    type: 'hyrox',
    name: 'Hyrox',
    shortName: 'Hyrox',
    icon: Timer,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Clases oficiales y preparación para competencia Hyrox',
    defaultZoneId: 'zone-hyrox',
  },
  musculacion: {
    type: 'musculacion',
    name: 'Musculación',
    shortName: 'Musculación',
    icon: Activity,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: 'Sala de pesas, barras, mancuernas y máquinas de fuerza',
    defaultZoneId: 'zone-muscu',
  },
  crossfit: {
    type: 'crossfit',
    name: 'CrossFit',
    shortName: 'CrossFit',
    icon: Barbell,
    tone: 'neutral',
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
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
    colorClass: 'text-ink-2',
    bgLightClass: 'bg-surface-elevated',
    badgeClass: 'border-line text-ink-2 bg-surface',
    description: '',
    defaultZoneId: zoneTypeOrId,
  }
}
