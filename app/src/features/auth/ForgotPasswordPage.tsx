import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, KeyRound, MailCheck } from 'lucide-react'
import { useGym } from '@/data/RepositoryProvider'
import {
  checkNewPassword,
  passwordIssueMessage,
  passwordStrength,
  RECOVERY_CODE_LENGTH,
} from '@/domain/rules/password'
import { Button, Input } from '@/ui/primitives'

type Step = 'email' | 'password' | 'code' | 'done'

/** Supabase no deja pedir otro correo al mismo usuario antes de 60 s. */
const RESEND_COOLDOWN_SECONDS = 60

const TITLES: Record<Step, string> = {
  email: 'Recuperar contraseña',
  password: 'Nueva contraseña',
  code: 'Revisa tu correo',
  done: '¡Contraseña actualizada!',
}

function sendErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'No se pudo enviar el código'
  const lower = msg.toLowerCase()
  if (lower.includes('rate limit') || lower.includes('over_email_send')) {
    return 'Se enviaron demasiados correos seguidos. Espera un momento y vuelve a intentarlo.'
  }
  return msg
}

/**
 * Recuperación con código: correo → contraseña nueva → código del correo →
 * listo. Todo ocurre dentro de la app (también la nativa): no hay enlace que
 * tenga que volver desde el navegador.
 */
export function ForgotPasswordPage() {
  const { repo } = useGym()
  const navigate = useNavigate()
  const initialEmail =
    (useLocation().state as { email?: string } | null)?.email ?? ''

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [demoCode, setDemoCode] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const check = checkNewPassword(password, confirmation)
  const strength = passwordStrength(password)

  async function sendCode() {
    await repo.resetPassword(email.trim())
    setCooldown(RESEND_COOLDOWN_SECONDS)
    // Solo el modo demo (sin correo real) expone el código.
    const peek = (repo as { peekRecoveryCode?: () => string | null }).peekRecoveryCode
    setDemoCode(peek ? peek.call(repo) : null)
  }

  function handleEmail(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico')
      return
    }
    setError(null)
    setStep('password')
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!check.ok) return
    setBusy(true)
    setError(null)
    try {
      await sendCode()
      setCode('')
      setStep('code')
    } catch (err) {
      setError(sendErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setBusy(true)
    setError(null)
    try {
      await sendCode()
    } catch (err) {
      setError(sendErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleCode(e: FormEvent) {
    e.preventDefault()
    if (code.length !== RECOVERY_CODE_LENGTH) {
      setError(`Escribe los ${RECOVERY_CODE_LENGTH} dígitos del código`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await repo.completePasswordReset(email.trim(), code, password)
      setPassword('')
      setConfirmation('')
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusy(false)
    }
  }

  function goToLogin() {
    navigate('/login', { replace: true, state: { recoveredEmail: email.trim() } })
  }

  const errorBox = error ? (
    <div className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null

  let body: ReactNode
  if (step === 'email') {
    body = (
      <form onSubmit={handleEmail} className="mt-5 space-y-4">
        <p className="text-xs leading-relaxed text-ink-2">
          Escribe el correo de tu cuenta de Zona Cero. Te enviaremos un código
          para confirmar el cambio.
        </p>
        <Input
          label="Correo electrónico"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu.correo@ejemplo.com"
          autoComplete="email"
          autoFocus
          required
        />
        {errorBox}
        <Button type="submit" className="w-full">
          Continuar
        </Button>
      </form>
    )
  } else if (step === 'password') {
    body = (
      <form onSubmit={handlePassword} className="mt-5 space-y-4">
        <p className="text-xs leading-relaxed text-ink-2">
          Elige tu contraseña nueva: al menos 8 caracteres, con letras y números.
        </p>
        <div>
          <Input
            label="Nueva contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
            required
          />
          {password ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex h-1 flex-1 gap-1">
                <span
                  className={`flex-1 rounded-full ${strength !== 'debil' || password.length >= 8 ? 'bg-acc' : 'bg-line'}`}
                />
                <span
                  className={`flex-1 rounded-full ${strength === 'media' || strength === 'fuerte' ? 'bg-acc' : 'bg-line'}`}
                />
                <span
                  className={`flex-1 rounded-full ${strength === 'fuerte' ? 'bg-acc' : 'bg-line'}`}
                />
              </div>
              <span className="text-xs font-semibold capitalize text-ink-3">
                {strength}
              </span>
            </div>
          ) : null}
        </div>
        <Input
          label="Confirmar contraseña"
          type="password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
          required
        />
        {touched && !check.ok ? (
          <ul className="space-y-1 rounded-2xl border border-danger/30 bg-danger/10 p-3">
            {check.issues.map((issue) => (
              <li key={issue} className="flex items-center gap-2 text-xs text-danger">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {passwordIssueMessage(issue)}
              </li>
            ))}
          </ul>
        ) : null}
        {errorBox}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Enviando código…' : 'Enviar código'}
        </Button>
        <button
          type="button"
          onClick={() => setStep('email')}
          className="block w-full text-center text-xs font-semibold text-ink-3 hover:text-ink"
        >
          Cambiar correo
        </button>
      </form>
    )
  } else if (step === 'code') {
    body = (
      <form onSubmit={handleCode} className="mt-5 space-y-4">
        <p className="text-xs leading-relaxed text-ink-2">
          Enviamos un código de {RECOVERY_CODE_LENGTH} dígitos a{' '}
          <span className="font-semibold text-acc-dark">{email.trim()}</span>. Si no
          lo ves, revisa el correo no deseado.
        </p>
        {demoCode ? (
          <p className="rounded-2xl border border-line bg-bg p-3 text-xs text-ink-3">
            Modo demo (sin correo): tu código es{' '}
            <span className="font-mono font-bold text-ink">{demoCode}</span>
          </p>
        ) : null}
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
        {errorBox}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Verificando…' : 'Cambiar contraseña'}
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
          <button
            type="button"
            onClick={() => {
              setError(null)
              setStep('email')
            }}
            className="text-ink-3 hover:text-ink"
          >
            Cambiar correo
          </button>
        </div>
      </form>
    )
  } else {
    body = (
      <div className="mt-5 space-y-4">
        <div className="flex items-start gap-3 rounded-2xl border border-acc/30 bg-acc/10 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acc-dark" />
          <p className="text-xs leading-relaxed text-ink-2">
            Tu contraseña se cambió correctamente. Ahora inicia sesión con la
            contraseña nueva.
          </p>
        </div>
        <Button className="w-full" onClick={goToLogin}>
          Ir a iniciar sesión
        </Button>
      </div>
    )
  }

  const Icon = step === 'done' ? CheckCircle2 : step === 'code' ? MailCheck : KeyRound

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/15 text-acc-dark">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold text-ink">{TITLES[step]}</h1>
            <p className="text-xs text-ink-3">Zona Cero Performance Center</p>
          </div>
        </div>

        {body}

        {step !== 'done' ? (
          <Link
            to="/login"
            className="mt-4 block text-center text-xs font-semibold text-ink-3 hover:text-ink"
          >
            Volver al inicio de sesión
          </Link>
        ) : null}
      </div>
    </main>
  )
}
