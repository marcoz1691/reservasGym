import { X } from 'lucide-react'
import { formatDateSpanish } from '@/lib/format'
import { Button } from '@/ui/primitives'
import { TERMS, termsArePublished } from './termsContent'

/** Términos y condiciones en una ventana, sin salir del pago (no se pierde lo escrito). */
export function TermsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl bg-bg-2 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="terms-title" className="text-lg font-bold text-ink">
              {TERMS.title}
            </h2>
            {TERMS.updatedAt ? (
              <p className="text-xs text-ink-3">Vigentes desde {formatDateSpanish(TERMS.updatedAt)}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar términos y condiciones"
            className="rounded-xl p-1.5 text-ink-3 transition hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-ink-2">
          {termsArePublished() ? (
            TERMS.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
          ) : (
            <p>
              Zona Cero está preparando este documento. Si tienes dudas sobre tu pago o tu
              membresía, consúltalas en recepción.
            </p>
          )}
        </div>
        <div className="border-t border-line px-5 py-4">
          <Button type="button" className="w-full" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  )
}
