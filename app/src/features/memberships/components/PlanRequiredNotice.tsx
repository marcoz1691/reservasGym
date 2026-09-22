import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

interface PlanRequiredNoticeProps {
  onDismiss?: () => void
}

export function PlanRequiredNotice({ onDismiss }: PlanRequiredNoticeProps) {
  return (
    <div
      data-testid="plan-required-notice"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plan-required-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-warn/40 bg-bg-2 p-6 shadow-2xl">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 transition hover:bg-surface hover:text-ink"
            aria-label="Cerrar recordatorio"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warn/15 text-warn">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h2
              id="plan-required-title"
              className="text-lg font-extrabold text-ink"
            >
              Activa tu plan para reservar
            </h2>
            <p className="text-xs font-semibold uppercase tracking-wide text-warn">
              Recordatorio
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Estás explorando Zona Cero. Cuando actives tu plan en recepción
          podrás reservar clases.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row">
          {onDismiss ? (
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onDismiss}
            >
              Ahora no
            </Button>
          ) : null}
          <ButtonLink
            to="/membresia"
            className="flex-1 justify-center"
            onClick={() => onDismiss?.()}
          >
            Ver planes
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
