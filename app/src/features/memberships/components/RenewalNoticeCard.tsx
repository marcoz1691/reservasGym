import {
  CreditCard,
  Banknote,
  Building2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'

interface RenewalNoticeCardProps {
  onlinePayEnabled?: boolean
}

export function RenewalNoticeCard({
  onlinePayEnabled = false,
}: RenewalNoticeCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-bg-2 to-surface/40 p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {onlinePayEnabled ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-acc/40 bg-acc/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-acc">
                <CreditCard className="h-3.5 w-3.5" />
                Pago en línea disponible
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-acc/40 bg-acc/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-acc">
                <Building2 className="h-3.5 w-3.5" />
                Renovación en Recepción
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-600">
              <Sparkles className="h-3.5 w-3.5" />
              {onlinePayEnabled
                ? 'Mercado Pago · tarjeta / débito'
                : 'Próximamente: Pago online con tarjeta desde la app'}
            </span>
          </div>

          <h3 className="text-lg font-black text-ink md:text-xl">
            {onlinePayEnabled
              ? 'Renueva o activa tu plan desde la app'
              : 'Renueva tu plan en recepción'}
          </h3>

          <p className="text-xs sm:text-sm text-ink-2 leading-relaxed">
            {onlinePayEnabled ? (
              <>
                Elige un plan abajo y pulsa <strong className="text-ink">Pagar en línea</strong>.
                Serás redirigido a Mercado Pago de forma segura. También puedes pagar en el counter
                de <strong className="text-ink">Zona Cero Performance Center</strong>.
              </>
            ) : (
              <>
                Acércate al counter de{' '}
                <strong className="text-ink">Zona Cero Performance Center</strong> para renovar o
                cambiar tu membresía. Aceptamos múltiples formas de pago para tu comodidad:
              </>
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="flex items-center gap-2.5 rounded-2xl border border-line/60 bg-bg/50 p-3 text-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                <Banknote className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-ink">Efectivo</p>
                <p className="text-[10px] text-ink-3">En caja / recepción</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-line/60 bg-bg/50 p-3 text-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-ink">Transferencia</p>
                <p className="text-[10px] text-ink-3">Bancos locales</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl border border-line/60 bg-bg/50 p-3 text-xs">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warn-soft text-warn">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-bold text-ink">
                  {onlinePayEnabled ? 'Tarjeta (app o POS)' : 'Tarjeta Datafast'}
                </p>
                <p className="text-[10px] text-ink-3">
                  {onlinePayEnabled ? 'MP online o datáfono' : 'Datáfono POS'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-line/60 pt-4 md:pt-0 md:pl-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-2">
            <ShieldCheck className="h-4 w-4 text-acc" />
            <span>Activación automática</span>
          </div>
          <p className="text-[11px] text-ink-3 max-w-[200px] md:text-right">
            {onlinePayEnabled
              ? 'Tras un pago aprobado, tu membresía se extiende sola en la app.'
              : 'Tu membresía se habilita al instante tras registrar el cobro en el sistema.'}
          </p>
        </div>
      </div>
    </div>
  )
}
