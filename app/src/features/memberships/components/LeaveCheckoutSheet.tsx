import { useEffect } from 'react'
import { CreditCard, X } from 'lucide-react'
import { Button } from '@/ui/primitives'

/**
 * Confirmación antes de abandonar el pago (como en las apps de cine): el socio
 * puede seguir pagando o salir. Se cierra con la X, con Escape o tocando fuera,
 * y en todos esos casos sigue en el pago.
 */
export function LeaveCheckoutSheet({
  onStay,
  onLeave,
}: {
  onStay: () => void
  onLeave: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onStay])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onStay}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-checkout-title"
        aria-describedby="leave-checkout-body"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-t-3xl bg-bg-2 px-6 pb-6 pt-10 text-center shadow-2xl sm:rounded-3xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}
      >
        <button
          type="button"
          onClick={onStay}
          aria-label="Cerrar y seguir con el pago"
          className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 transition hover:bg-surface hover:text-ink"
        >
          <X className="h-5 w-5" />
        </button>
        <span
          aria-hidden
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated text-ink"
        >
          <CreditCard className="h-7 w-7" />
        </span>
        <h2 id="leave-checkout-title" className="mt-4 text-lg font-bold text-ink">
          ¿Quieres salir del pago?
        </h2>
        <p id="leave-checkout-body" className="mt-2 text-sm leading-relaxed text-ink-2">
          Lo que escribiste no se guarda. Si sales, tu plan no cambia y puedes volver a pagar
          cuando quieras.
        </p>
        <div className="mt-6 space-y-2.5">
          <Button autoFocus type="button" size="lg" className="w-full" onClick={onStay}>
            Continuar con el pago
          </Button>
          <Button type="button" size="lg" variant="secondary" className="w-full" onClick={onLeave}>
            Salir del pago
          </Button>
        </div>
      </div>
    </div>
  )
}
