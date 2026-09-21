import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

interface WelcomeNoPlanCardProps {
  /** Con VITE_ONLINE_PAYMENTS activo se menciona el pago con tarjeta */
  onlinePayEnabled?: boolean
}

export function WelcomeNoPlanCard({
  onlinePayEnabled = false,
}: WelcomeNoPlanCardProps) {
  return (
    <Card className="relative overflow-hidden border-acc/25 p-0">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-acc-glow blur-3xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-acc">
          <Sparkles className="h-3.5 w-3.5" />
          Primer paso
        </div>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
          Activa tu plan y empieza a entrenar
        </h2>
        <p className="mt-1.5 text-sm text-ink-2">
          Tu cuenta ya está lista. Elige el plan que se ajuste a tus objetivos y
          {onlinePayEnabled
            ? ' actívalo en línea con tarjeta o en recepción.'
            : ' actívalo en recepción.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ButtonLink to="/membresia" size="sm">
            Ver planes
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <Link
            to="/explorar"
            className="focus-ring rounded-lg text-xs font-bold text-acc hover:text-acc-hi"
          >
            Explorar áreas
          </Link>
        </div>
      </div>
    </Card>
  )
}
