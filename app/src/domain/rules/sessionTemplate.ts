import type { ClassTemplate, SessionKind } from '@/domain/models'

/** Plantilla de catálogo mínima para resolver el FK `sessions.template_id`. */
type CatalogTemplate = Pick<ClassTemplate, 'id' | 'zoneId' | 'kind'>

/**
 * Supabase exige que `sessions.template_id` exista en `class_templates`.
 * No se pueden inventar ids tipo `tpl_custom_*`.
 */
export function resolveSessionTemplateId(
  templates: CatalogTemplate[],
  zoneId: string,
  kind: SessionKind,
  existingTemplateId?: string,
): string {
  if (existingTemplateId && templates.some((t) => t.id === existingTemplateId)) {
    return existingTemplateId
  }

  const exact = templates.find((t) => t.zoneId === zoneId && t.kind === kind)
  if (exact) return exact.id

  const zoneMatch = templates.find((t) => t.zoneId === zoneId)
  if (zoneMatch) return zoneMatch.id

  throw new Error(
    'No hay plantilla de clase para esta disciplina. Recarga el catálogo o crea la plantilla primero.',
  )
}
