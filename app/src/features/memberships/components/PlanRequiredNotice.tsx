import { ArrowRight, Sparkles } from 'lucide-react'
import { ButtonLink } from '@/ui/ButtonLink'

export function PlanRequiredNotice() {
  return (
    <div
      data-testid="plan-required-notice"
      className="flex flex-col gap-3 rounded-2xl border border-acc/30 bg-acc/10 p-3.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2 text-xs font-semibold text-ink-2 sm:text-sm">
        <Sparkles className="h-4 w-4 shrink-0 text-acc" />
        Estás explorando la agenda. Activa tu plan para reservar.
      </p>
      <ButtonLink to="/membresia" size="sm" className="shrink-0">
        Ver planes
        <ArrowRight className="h-4 w-4" />
      </ButtonLink>
    </div>
  )
}
