import { useEffect, useState, type FormEvent } from 'react'
import {
  useAppData,
  useCurrentUser,
  useRefresh,
  useRepo,
} from '@/data/RepositoryProvider'
import type { GymSettings } from '@/domain/models'
import { isFeatureEnabled, normalizeWhatsAppPhone, type AppFeature } from '@/domain/rules'
import { applyBrandColors } from '@/lib/format'
import { Button, Card, EmptyState, Input, PageHeader } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

const FEATURE_SWITCHES: {
  feature: AppFeature
  setting: keyof Pick<
    GymSettings,
    'onlinePaymentsEnabled' | 'waitlistEnabled' | 'measurementsEnabled' | 'dayPassesEnabled'
  >
  label: string
  detail: string
}[] = [
  {
    feature: 'onlinePayments',
    setting: 'onlinePaymentsEnabled',
    label: 'Pago en línea',
    detail: 'Los socios pagan su plan con tarjeta desde la app. Si lo apagas, solo verán efectivo, transferencia y Deuna.',
  },
  {
    feature: 'waitlist',
    setting: 'waitlistEnabled',
    label: 'Lista de espera',
    detail: 'Con la clase llena, el socio se anota y toma el cupo que se libere. Apagada, la clase llena no acepta más.',
  },
  {
    feature: 'measurements',
    setting: 'measurementsEnabled',
    label: 'Medidas corporales',
    detail: 'Los socios registran su peso y ven su progreso. Apagado, la sección se oculta.',
  },
  {
    feature: 'dayPasses',
    setting: 'dayPassesEnabled',
    label: 'Pases diarios en la app',
    detail: 'Los socios compran pases diarios desde la app. Recepción siempre puede venderlos en Cobros.',
  },
]

type PaymentDetailKey = keyof Pick<
  GymSettings,
  | 'whatsappPayments'
  | 'bankName'
  | 'bankAccountType'
  | 'bankAccountNumber'
  | 'bankAccountHolder'
  | 'bankAccountId'
  | 'deunaCode'
  | 'deunaQrUrl'
>

const PAYMENT_DETAIL_FIELDS: {
  key: PaymentDetailKey
  label: string
  placeholder: string
  group: 'whatsapp' | 'bank' | 'deuna'
}[] = [
  { key: 'whatsappPayments', label: 'WhatsApp para comprobantes', placeholder: 'Ej. 0991234567', group: 'whatsapp' },
  { key: 'bankName', label: 'Banco', placeholder: 'Ej. Banco Pichincha', group: 'bank' },
  { key: 'bankAccountType', label: 'Tipo de cuenta', placeholder: 'Ahorros o corriente', group: 'bank' },
  { key: 'bankAccountNumber', label: 'Número de cuenta', placeholder: 'Ej. 2201234567', group: 'bank' },
  { key: 'bankAccountHolder', label: 'Titular', placeholder: 'Nombre del titular', group: 'bank' },
  { key: 'bankAccountId', label: 'RUC o cédula del titular', placeholder: 'Ej. 1712345678001', group: 'bank' },
  { key: 'deunaCode', label: 'Código de Deuna', placeholder: 'Código o número para pagar con Deuna', group: 'deuna' },
  { key: 'deunaQrUrl', label: 'URL de la imagen del QR de Deuna', placeholder: 'https://…', group: 'deuna' },
]

const PAYMENT_GROUP_TITLES = {
  whatsapp: 'Comprobantes',
  bank: 'Transferencia bancaria',
  deuna: 'Deuna',
} as const

function paymentDetailsFrom(settings: GymSettings): Record<PaymentDetailKey, string> {
  return Object.fromEntries(
    PAYMENT_DETAIL_FIELDS.map(({ key }) => [key, settings[key] ?? '']),
  ) as Record<PaymentDetailKey, string>
}

function validatePaymentDetails(details: Record<PaymentDetailKey, string>): string | null {
  if (details.whatsappPayments.trim() && !normalizeWhatsAppPhone(details.whatsappPayments)) {
    return 'Revisa el número de WhatsApp: usa un celular como 0991234567 o 593991234567.'
  }
  if (details.deunaQrUrl.trim() && !/^https:\/\//i.test(details.deunaQrUrl.trim())) {
    return 'La URL del QR de Deuna debe empezar con https://'
  }
  return null
}

function settingsErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'No se pudo guardar la marca.'
  if (/coerce the result|JSON object|row-level security|permission/i.test(msg)) {
    return 'No se pudo guardar la marca. Tu usuario no tiene permiso para cambiarla.'
  }
  return msg
}

export function BrandingPage() {
  const user = useCurrentUser()
  const data = useAppData()
  const repo = useRepo()
  const refresh = useRefresh()
  const [name, setName] = useState(data.settings.name)
  const [logoUrl, setLogoUrl] = useState(data.settings.logoUrl ?? '')
  const [accentColor, setAccentColor] = useState(data.settings.accentColor)
  const [msg, setMsg] = useState('')
  const [savingFeature, setSavingFeature] = useState<AppFeature | null>(null)
  const [paymentDetails, setPaymentDetails] = useState(() => paymentDetailsFrom(data.settings))
  const [paymentMsg, setPaymentMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [savingPayments, setSavingPayments] = useState(false)
  const pagomediosConfigured = import.meta.env.VITE_ONLINE_PAYMENTS === '1'

  useEffect(() => {
    setName(data.settings.name)
    setLogoUrl(data.settings.logoUrl ?? '')
    setAccentColor(data.settings.accentColor)
    setPaymentDetails(paymentDetailsFrom(data.settings))
  }, [data.settings])

  async function savePaymentDetails(e: FormEvent) {
    e.preventDefault()
    const invalid = validatePaymentDetails(paymentDetails)
    if (invalid) {
      setPaymentMsg({ tone: 'error', text: invalid })
      return
    }
    setSavingPayments(true)
    try {
      await repo.updateSettings(
        Object.fromEntries(
          PAYMENT_DETAIL_FIELDS.map(({ key }) => [key, paymentDetails[key].trim() || null]),
        ) as Partial<GymSettings>,
      )
      await refresh()
      setPaymentMsg({ tone: 'ok', text: 'Datos de pago actualizados' })
    } catch (err) {
      setPaymentMsg({ tone: 'error', text: settingsErrorMessage(err) })
    } finally {
      setSavingPayments(false)
    }
  }

  async function toggleFeature(feature: AppFeature, setting: (typeof FEATURE_SWITCHES)[number]['setting']) {
    setSavingFeature(feature)
    try {
      await repo.updateSettings({ [setting]: !isFeatureEnabled(data.settings, feature) })
      await refresh()
      setMsg('Funciones actualizadas')
    } catch (err) {
      setMsg(settingsErrorMessage(err))
    } finally {
      setSavingFeature(null)
    }
  }

  if (user && user.role !== 'admin') {
    return (
      <div className="py-12 text-center">
        <EmptyState
          title="Acceso restringido"
          description="La marca y las funciones del gym solo las puede cambiar un administrador."
          action={
            <ButtonLink to="/">Volver al inicio</ButtonLink>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Personalización"
        subtitle="Marca, funciones de la app y datos de pago"
        action={
          <ButtonLink to="/admin" variant="ghost">Volver al admin</ButtonLink>
        }
      />
      {msg ? <p className="mb-3 text-sm text-acc-dark">{msg}</p> : null}

      <Card className="max-w-lg space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void (async () => {
              try {
                const settings = await repo.updateSettings({
                  name: name.trim() || data.settings.name,
                  logoUrl: logoUrl.trim() || null,
                  accentColor: accentColor || data.settings.accentColor,
                })
                applyBrandColors(settings.primaryColor, settings.accentColor)
                await refresh()
                setMsg('Marca actualizada')
              } catch (err) {
                setMsg(settingsErrorMessage(err))
              }
            })()
          }}
        >
          <Input
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="URL del logo"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
          />
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
              Color de acento
            </span>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor || '#F26D17'}
                aria-label="Selector de color de acento"
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-xl border border-line bg-surface-elevated"
              />
              <Input
                value={accentColor}
                aria-label="Color de acento en hexadecimal"
                onChange={(e) => setAccentColor(e.target.value)}
                className="font-mono"
              />
            </div>
          </label>

          <div
            className="rounded-2xl border border-line p-4"
            style={{ borderColor: accentColor }}
          >
            <p className="text-xs font-bold uppercase text-ink-3">Vista previa</p>
            <p className="mt-1 text-xl font-extrabold">{name || 'Nombre'}</p>
            <div
              className="mt-3 inline-flex rounded-2xl px-4 py-2 text-sm font-bold text-[var(--color-acc-contrast)] shadow-md"
              style={{ background: accentColor }}
            >
              Botón de ejemplo
            </div>
          </div>

          <Button type="submit">Guardar marca</Button>
        </form>
      </Card>

      <Card className="mt-6 max-w-lg space-y-4">
        <h2 className="font-display text-lg font-bold text-ink">Funciones de la app</h2>
        <ul className="divide-y divide-line">
          {FEATURE_SWITCHES.map(({ feature, setting, label, detail }) => {
            const on = isFeatureEnabled(data.settings, feature)
            const unavailable = feature === 'onlinePayments' && !pagomediosConfigured
            const id = `feature-${feature}`
            return (
              <li key={feature} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p id={id} className="text-sm font-semibold text-ink">
                    {label}
                  </p>
                  <p className="text-xs text-ink-3">{detail}</p>
                  {unavailable ? (
                    <p className="mt-1 text-xs font-semibold text-warn">
                      Pagomedios no está configurado en este ambiente
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-labelledby={id}
                  disabled={unavailable || savingFeature !== null}
                  onClick={() => void toggleFeature(feature, setting)}
                  className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    on ? 'bg-acc' : 'bg-line-strong'
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
                      on ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card className="mt-6 max-w-lg space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Datos de pago</h2>
          <p className="text-xs text-ink-3">
            Los socios los ven al elegir transferencia o Deuna. Lo que dejes vacío no se muestra:
            sin WhatsApp no aparece el botón para enviar el comprobante y sin código ni QR no se
            ofrece Deuna.
          </p>
        </div>
        <form className="space-y-5" onSubmit={(e) => void savePaymentDetails(e)}>
          {(Object.keys(PAYMENT_GROUP_TITLES) as (keyof typeof PAYMENT_GROUP_TITLES)[]).map((group) => (
            <fieldset key={group} className="space-y-3">
              <legend className="text-xs font-bold uppercase tracking-wide text-ink-3">
                {PAYMENT_GROUP_TITLES[group]}
              </legend>
              {PAYMENT_DETAIL_FIELDS.filter((field) => field.group === group).map(
                ({ key, label, placeholder }) => (
                  <Input
                    key={key}
                    label={label}
                    value={paymentDetails[key]}
                    onChange={(e) => {
                      const value = e.target.value
                      setPaymentDetails((current) => ({ ...current, [key]: value }))
                    }}
                    placeholder={placeholder}
                    inputMode={key === 'whatsappPayments' ? 'tel' : undefined}
                  />
                ),
              )}
            </fieldset>
          ))}
          {paymentMsg ? (
            <p
              role={paymentMsg.tone === 'error' ? 'alert' : 'status'}
              className={`text-sm ${paymentMsg.tone === 'error' ? 'text-danger' : 'text-acc-dark'}`}
            >
              {paymentMsg.text}
            </p>
          ) : null}
          <Button type="submit" disabled={savingPayments}>
            {savingPayments ? 'Guardando…' : 'Guardar datos de pago'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
