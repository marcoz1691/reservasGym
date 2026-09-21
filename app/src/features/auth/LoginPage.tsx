import { useState, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Fingerprint, Sparkles } from 'lucide-react'
import {
  useAppData,
  useCurrentUser,
  useGym,
  useRefresh,
} from '@/data/RepositoryProvider'
import {
  authenticateWithBiometrics,
  getSavedBiometricUser,
  isBiometricsEnabled,
} from '@/lib/biometrics'
import { displayFirstName } from '@/domain/rules'
import { Button, Card, Input } from '@/ui/primitives'
import { ForgotPasswordModal } from './ForgotPasswordModal'

const IS_STAGING = import.meta.env.MODE === 'staging'
const DEMO_PASSWORD = IS_STAGING ? 'ZonaCero2026!' : 'demo1234'
const DEMO_ACCOUNTS = IS_STAGING
  ? {
      socio: 'socio.staging@zonacero.test',
      staff: 'staff.staging@zonacero.test',
      admin: 'admin.staging@zonacero.test',
    }
  : {
      socio: 'socio@gym.local',
      staff: 'staff@gym.local',
      admin: 'admin@gym.local',
    }

export function LoginPage() {
  const user = useCurrentUser()
  const { repo, loading } = useGym()
  const refresh = useRefresh()
  const { settings } = useAppData()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  // Login fields — staging usa cuentas @zonacero.test (ver supabase/staging-users.sql)
  const [loginEmail, setLoginEmail] = useState(DEMO_ACCOUNTS.socio)
  const [loginPassword, setLoginPassword] = useState(DEMO_PASSWORD)

  // Register fields: Simple initial account creation
  const [fullName, setFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [bioUser, setBioUser] = useState<{ fullName: string; email: string } | null>(null)
  const [bioAvailable, setBioAvailable] = useState(false)

  useEffect(() => {
    const enabled = isBiometricsEnabled()
    const saved = getSavedBiometricUser()
    setBioAvailable(enabled || saved !== null)
    if (saved) {
      setBioUser(saved)
    }
  }, [])

  if (!loading && user) {
    return <Navigate to={user.role === 'member' ? '/' : '/admin'} replace />
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      await repo.signIn({ email: loginEmail, password: loginPassword })
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión'
      setError(msg.includes('recursion') ? `${msg} — ejecuta fix-is-staff-rls.sql en Supabase` : msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBiometricLogin() {
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const bioAuth = await authenticateWithBiometrics()
      // Try to sign in with standard demo pass or saved session
      try {
        await repo.signIn({ email: bioAuth.email, password: DEMO_PASSWORD })
      } catch {
        await repo.signIn({
          email: bioAuth.email,
          password: loginPassword || DEMO_PASSWORD,
        })
      }
      await refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo verificar la identidad biométrica',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function goToLoginAfterSignup(email: string, message: string) {
    setError('')
    setSuccess(message)
    setLoginEmail(email)
    setLoginPassword('')
    setFullName('')
    setRegisterEmail('')
    setRegisterPassword('')
    setConfirmPassword('')
    setMode('login')
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('Ingresa tu nombre completo')
      return
    }
    if (!registerEmail.trim()) {
      setError('Ingresa tu correo electrónico')
      return
    }
    if (!registerPassword || registerPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (registerPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setError('')
    setSuccess('')
    setSubmitting(true)

    const email = registerEmail.trim()

    try {
      await repo.signUp({
        email,
        password: registerPassword,
        fullName: fullName.trim(),
      })
      // Flujo esperado: crear cuenta → iniciar sesión → ficha en /bienvenida.
      // Si Supabase dejó sesión abierta, la cerramos para forzar el login.
      try {
        await repo.signOut()
      } catch {
        /* sin sesión previa: ok */
      }
      await refresh()
      goToLoginAfterSignup(
        email,
        'Cuenta creada correctamente. Ahora inicia sesión con tu correo y contraseña. Al entrar por primera vez completarás tu ficha técnica.',
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la cuenta'
      if (msg.startsWith('PENDING_EMAIL_CONFIRMATION:')) {
        goToLoginAfterSignup(email, msg.replace('PENDING_EMAIL_CONFIRMATION:', ''))
        return
      }
      // Mensaje legado (deploys anteriores) — tratarlo como éxito, no como error
      if (msg.startsWith('Cuenta creada')) {
        goToLoginAfterSignup(email, msg)
        return
      }
      const lower = msg.toLowerCase()
      if (lower.includes('rate limit') || lower.includes('over_email_send')) {
        setError(
          'Se alcanzó el límite de correos de prueba en QA. En Supabase → Authentication → Providers → Email, desactiva «Confirm email» (solo staging) o espera ~1 hora.',
        )
        return
      }
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4 py-10">
      <Card className="w-full max-w-lg space-y-6 p-6 sm:p-8">
        {/* Brand header — imagotipo centrado, como en la maqueta del login */}
        <div className="text-center">
          <img
            src={settings.logoUrl || `${import.meta.env.BASE_URL}brand/logo-color.png`}
            alt={settings.name || 'Zona Cero'}
            className="mx-auto h-14 w-auto"
          />
          <p className="mt-3 text-xs text-ink-3">
            Centro de Rendimiento · Reservas & Entrenamiento
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex rounded-2xl bg-bg p-1 border border-line">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setError('')
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              mode === 'login'
                ? 'bg-acc text-[var(--color-acc-contrast)] font-bold shadow-xs'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register')
              setError('')
              setSuccess('')
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              mode === 'register'
                ? 'bg-acc text-[var(--color-acc-contrast)] font-bold shadow-xs'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {mode === 'login' ? (
          /* LOGIN FORM */
          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Biometric Quick Login Button */}
            {bioAvailable && (
              <div className="rounded-2xl border border-acc/30 bg-acc/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-acc/20 text-acc">
                      <Fingerprint className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink">
                        {bioUser
                          ? `Hola, ${displayFirstName(bioUser.fullName)}`
                          : 'Acceso Biométrico'}
                      </p>
                      <p className="text-[11px] text-ink-3">
                        {bioUser ? bioUser.email : 'Ingreso rápido Face ID / Huella'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={handleBiometricLogin}
                    disabled={submitting}
                    className="h-9 px-3 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Fingerprint className="h-4 w-4" />
                    <span>Ingresar</span>
                  </Button>
                </div>
              </div>
            )}

            <Input
              label="Correo electrónico"
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="socio@gym.local"
              required
            />

            <div>
              <Input
                label="Contraseña"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <div className="mt-1.5 text-right">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(true)}
                  className="text-xs text-acc hover:underline font-semibold"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            {success ? (
              <p className="rounded-xl border border-success/40 bg-success-soft p-3 text-xs text-success font-semibold">
                {success}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-semibold">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full font-bold" disabled={submitting}>
              {submitting ? 'Iniciando sesión…' : 'Entrar'}
            </Button>

            {/* Demo Helper */}
            <div className="mt-6 rounded-2xl border border-line bg-bg p-3.5 text-xs text-ink-3 space-y-2">
              <p className="font-bold text-ink-2 flex items-center justify-between">
                <span>
                  {IS_STAGING
                    ? 'Acceso rápido QA (staging):'
                    : 'Acceso rápido demo (desarrollo):'}
                </span>
                <span className="text-[10px] text-acc font-mono">{DEMO_PASSWORD}</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(DEMO_ACCOUNTS.socio)
                    setLoginPassword(DEMO_PASSWORD)
                  }}
                  className="rounded-xl border border-line bg-surface/60 px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:border-acc/40 transition"
                >
                  Socio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(DEMO_ACCOUNTS.staff)
                    setLoginPassword(DEMO_PASSWORD)
                  }}
                  className="rounded-xl border border-line bg-surface/60 px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:border-acc/40 transition"
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail(DEMO_ACCOUNTS.admin)
                    setLoginPassword(DEMO_PASSWORD)
                  }}
                  className="rounded-xl border border-line bg-surface/60 px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:border-acc/40 transition"
                >
                  Admin
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* STREAMLINED REGISTRATION FORM */
          <form className="space-y-4" onSubmit={handleRegister}>
            <div className="rounded-2xl border border-acc/20 bg-acc/5 p-4 text-xs text-ink-2">
              <div className="flex items-center gap-2 font-bold text-acc">
                <Sparkles className="h-4 w-4" />
                <span>Crea tu cuenta de socio</span>
              </div>
              <p className="mt-1 text-ink-3">
                Después de crear y confirmar la cuenta, inicia sesión. En el primer
                ingreso completarás tu ficha técnica (peso, estatura y metas).
              </p>
            </div>

            <div className="space-y-3.5">
              <Input
                label="Nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                required
              />

              <Input
                label="Correo electrónico"
                type="email"
                value={registerEmail}
                onChange={(e) => setRegisterEmail(e.target.value)}
                placeholder="tu.correo@ejemplo.com"
                required
              />

              <Input
                label="Contraseña (mínimo 8 caracteres)"
                type="password"
                value={registerPassword}
                onChange={(e) => setRegisterPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />

              <Input
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            {error ? (
              <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger font-semibold">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full font-bold" disabled={submitting}>
              {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>
        )}
      </Card>

      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
      />
    </div>
  )
}
