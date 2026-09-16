import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Dumbbell, KeyRound } from 'lucide-react'
import { useGym } from '@/data/RepositoryProvider'
import {
  checkNewPassword,
  passwordIssueMessage,
  passwordStrength,
} from '@/domain/rules/password'
import { Button, Input, Spinner } from '@/ui/primitives'

type Phase = 'checking' | 'invalid' | 'form' | 'done'

/**
 * ZCAPP-46 — pantalla a la que llega el socio desde el enlace del correo.
 *
 * Supabase canjea el token del hash de la URL por una sesión temporal antes
 * de que este componente monte (detectSessionInUrl). Si esa sesión existe,
 * el enlace era válido y se permite fijar la contraseña.
 */
export function ResetPasswordPage() {
  const { repo, refresh } = useGym()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Sin el método, no se puede verificar el enlace: se asume válido y
      // que el fallo aparezca al guardar, en vez de bloquear al socio.
      if (!repo.hasRecoverySession) {
        if (!cancelled) setPhase('form')
        return
      }
      try {
        const ok = await repo.hasRecoverySession()
        if (!cancelled) setPhase(ok ? 'form' : 'invalid')
      } catch {
        if (!cancelled) setPhase('invalid')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [repo])

  const check = checkNewPassword(password, confirmation)
  const strength = passwordStrength(password)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!check.ok) return

    setSubmitting(true)
    setError(null)
    try {
      await repo.updatePassword(password)
      await refresh()
      setPhase('done')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la contraseña',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-acc/15 text-acc">
            {phase === 'done' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <KeyRound className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="font-display text-lg font-extrabold text-ink">
              {phase === 'done' ? 'Contraseña actualizada' : 'Nueva contraseña'}
            </h1>
            <p className="text-xs text-ink-3">Zona Cero Performance Center</p>
          </div>
        </div>

        {phase === 'checking' ? (
          <div className="py-10">
            <Spinner />
            <p className="mt-3 text-center text-xs text-ink-3">
              Verificando el enlace…
            </p>
          </div>
        ) : null}

        {phase === 'invalid' ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-ink">Enlace vencido o inválido</p>
                <p className="text-ink-2 leading-relaxed">
                  Los enlaces de recuperación caducan por seguridad. Pide uno
                  nuevo desde la pantalla de inicio de sesión.
                </p>
              </div>
            </div>
            <Link to="/login" className="block">
              <Button className="w-full">Volver al inicio de sesión</Button>
            </Link>
          </div>
        ) : null}

        {phase === 'form' ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <p className="text-xs leading-relaxed text-ink-2">
              Elige una contraseña nueva para tu cuenta. Necesitas al menos 8
              caracteres, con letras y números.
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
                  <span className="text-[11px] font-semibold capitalize text-ink-3">
                    {strength}
                  </span>
                </div>
              ) : null}
            </div>

            <Input
              label="Repite la contraseña"
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              required
            />

            {touched && !check.ok ? (
              <ul className="space-y-1 rounded-2xl border border-danger/30 bg-danger/10 p-3">
                {check.issues.map((issue) => (
                  <li
                    key={issue}
                    className="flex items-center gap-2 text-xs text-danger"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {passwordIssueMessage(issue)}
                  </li>
                ))}
              </ul>
            ) : null}

            {error ? (
              <div className="flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </Button>

            <Link
              to="/login"
              className="block text-center text-xs font-semibold text-ink-3 hover:text-ink"
            >
              Cancelar
            </Link>
          </form>
        ) : null}

        {phase === 'done' ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-acc/30 bg-acc/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-acc" />
              <p className="text-xs leading-relaxed text-ink-2">
                Tu contraseña quedó actualizada. Ya puedes usarla para entrar.
              </p>
            </div>
            <Button className="w-full" onClick={() => navigate('/', { replace: true })}>
              Ir a la aplicación
            </Button>
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-line pt-4 text-[11px] text-ink-3">
          <Dumbbell className="h-3.5 w-3.5" />
          <span>Zona Cero Performance Center</span>
        </div>
      </div>
    </div>
  )
}
