import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Card } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

interface WelcomeNoPlanCardProps {
  /** Con el pago en línea activo (isOnlinePayEnabled) se menciona el pago con tarjeta */
  onlinePayEnabled?: boolean
}

export function WelcomeNoPlanCard({
  onlinePayEnabled = false,
}: WelcomeNoPlanCardProps) {
  return (
    <Card className="relative overflow-hidden p-0">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-acc/50 via-acc/10 to-transparent"
      />
      <div className="relative p-5 sm:p-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-acc/25 bg-acc-soft px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-acc">
          <Sparkles className="h-3 w-3" />
          Primer paso
        </div>
        <h2 className="mt-3 font-display text-2xl font-extrabold text-ink">
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
