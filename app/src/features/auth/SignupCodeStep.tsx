import { useEffect, useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { useGym, useRefresh } from '@/data/RepositoryProvider'
import { RECOVERY_CODE_LENGTH } from '@/domain/rules/password'
import { Button, Input } from '@/ui/primitives'

/** Supabase no deja pedir otro correo al mismo usuario antes de 60 s. */
const RESEND_COOLDOWN_SECONDS = 60

function resendErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'No se pudo reenviar el código'
  const lower = msg.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('over_email_send')) {
    return 'Se enviaron demasiados correos seguidos. Espera un momento y vuelve a intentarlo.'
  }
  return msg
}

/**
 * Confirmación de la cuenta nueva con el código del correo. Todo pasa dentro de
 * la app (también la nativa): al confirmar queda la sesión abierta y el router
 * lleva al socio a su ficha técnica.
 */
export function SignupCodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { repo } = useGym()
  const refresh = useRefresh()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // El correo acaba de salir al crear la cuenta.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    if (code.length !== RECOVERY_CODE_LENGTH) {
      setError(`Escribe los ${RECOVERY_CODE_LENGTH} dígitos del código`)
      return
    }
    if (!repo.confirmSignUp) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await repo.confirmSignUp(email, code)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la cuenta')
      setBusy(false)
    }
  }

  async function handleResend() {
    if (!repo.resendSignUpCode) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await repo.resendSignUpCode(email)
      setCooldown(RESEND_COOLDOWN_SECONDS)
      setNotice('Te enviamos un código nuevo.')
    } catch (err) {
      setError(resendErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleConfirm}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/15 text-acc-dark">
          <MailCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-lg font-extrabold text-ink">Confirma tu cuenta</h1>
          <p className="text-xs text-ink-3">Último paso para entrar</p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-2">
        Enviamos un código de {RECOVERY_CODE_LENGTH} dígitos a{' '}
        <span className="font-semibold text-acc-dark">{email}</span>. Si no lo ves,
        revisa el correo no deseado.
      </p>
      <Input
        label="Código"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) =>
          setCode(e.target.value.replace(/\D/g, '').slice(0, RECOVERY_CODE_LENGTH))
        }
        placeholder="123456"
        className="text-center font-mono text-lg tracking-[0.5em]"
        autoFocus
        required
      />
      {notice ? (
        <p className="rounded-xl border border-success/40 bg-success-soft p-3 text-xs text-success font-semibold">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-semibold">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full font-bold" disabled={busy}>
        {busy ? 'Verificando…' : 'Confirmar y entrar'}
      </Button>
      <div className="flex items-center justify-between text-xs font-semibold">
        <button
          type="button"
          onClick={() => void handleResend()}
          disabled={busy || cooldown > 0}
          className="text-acc-dark hover:underline disabled:text-ink-3 disabled:no-underline"
        >
          {cooldown > 0 ? `Reenviar código (${cooldown} s)` : 'Reenviar código'}
        </button>
        <button type="button" onClick={onBack} className="text-ink-3 hover:text-ink">
          Volver
        </button>
      </div>
    </form>
  )
}
