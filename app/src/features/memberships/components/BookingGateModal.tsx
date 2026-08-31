import { useNavigate } from 'react-router-dom'
import { ShieldAlert, Lock, X, ArrowRight } from 'lucide-react'
import { Button } from '@/ui/primitives'

export type BookingGateType = 'membership_expired' | 'no_membership' | 'zone_restricted'

interface BookingGateModalProps {
  isOpen: boolean
  onClose: () => void
  type: BookingGateType | null
  zoneName?: string
  message?: string
}

export function BookingGateModal({
  isOpen,
  onClose,
  type,
  zoneName = '',
  message,
}: BookingGateModalProps) {
  const navigate = useNavigate()

  if (!isOpen || !type) return null

  const isZoneRestricted = type === 'zone_restricted'

  const title = isZoneRestricted
    ? 'Área no incluida en tu plan'
    : type === 'no_membership'
      ? 'Membresía requerida'
      : 'Membresía vencida'

  const description =
    message ||
    (isZoneRestricted
      ? `Tu plan actual no incluye acceso al área ${zoneName || 'seleccionada'}. Consulta en recepción para actualizar tu plan.`
      : 'No puedes crear nuevas reservas: Tu membresía está vencida. Acércate a recepción.')

  function handleGoToMembership() {
    onClose()
    navigate('/membresia')
  }

  return (
    <div
      data-testid="booking-gate-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-3xl border border-line bg-bg-2 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              isZoneRestricted
                ? 'bg-warn/15 text-warn'
                : 'bg-danger/15 text-danger'
            }`}
          >
            {isZoneRestricted ? (
              <Lock className="h-6 w-6" />
            ) : (
              <ShieldAlert className="h-6 w-6" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-ink">{title}</h2>
            <p className="text-xs text-ink-3">Restricción de reserva</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-4">
          <p className="text-sm leading-relaxed text-ink-2">{description}</p>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2.5">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            variant={isZoneRestricted ? 'primary' : 'danger'}
            className="flex-1 gap-2"
            onClick={handleGoToMembership}
          >
            <span>Ir a Mi plan</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
