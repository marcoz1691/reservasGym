import { useState, type FormEvent } from 'react'
import { KeyRound, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { useGym } from '@/data/RepositoryProvider'
import { Button, Input } from '@/ui/primitives'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  initialEmail?: string
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  initialEmail = '',
}: ForgotPasswordModalProps) {
  const { repo } = useGym()
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await repo.resetPassword(email.trim())
      setSuccess(true)
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo enviar el correo de recuperación'
      const lower = msg.toLowerCase()
      if (lower.includes('rate limit') || lower.includes('over_email_send')) {
        setError(
          'Límite de correos de prueba en QA (pocos por hora). En Supabase → Authentication → Rate Limits, sube «rate_limit_email_sent», o espera ~1 hora. El enlace de pruebas está en: select * from qa_mail.enlaces;',
        )
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setSuccess(false)
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forgot-password-title"
        className="relative w-full max-w-md rounded-3xl border border-line bg-bg-2 p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
          aria-label="Cerrar modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc/15 text-acc">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="forgot-password-title"
              className="text-lg font-extrabold text-ink"
            >
              Recuperar contraseña
            </h2>
            <p className="text-xs text-ink-3">Te enviaremos un enlace a tu correo</p>
          </div>
        </div>

        {success ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-acc/30 bg-acc/10 p-4 text-ink">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-acc mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-ink">¡Enlace enviado!</p>
                <p className="text-ink-2">
                  Si la cuenta <span className="font-semibold text-acc">{email}</span> existe, recibirás instrucciones para restablecer tu contraseña.
                </p>
                <p className="text-ink-3">
                  Revisa también la carpeta de correo no deseado. El enlace
                  caduca por seguridad.
                </p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={handleClose}
            >
              Volver al inicio de sesión
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-xs text-ink-2 leading-relaxed">
              Ingresa el correo electrónico asociado a tu cuenta de Zona Cero para recibir las instrucciones de recuperación.
            </p>

            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              required
              autoFocus
            />

            {error ? (
              <div className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
