import { useState, useEffect, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Dumbbell,
  Fingerprint,
  Sparkles,
} from 'lucide-react'
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
import { Button, Card, Input } from '@/ui/primitives'
import { ForgotPasswordModal } from './ForgotPasswordModal'

export function LoginPage() {
  const user = useCurrentUser()
  const { repo, loading } = useGym()
  const refresh = useRefresh()
  const { settings } = useAppData()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  // Login fields
  const [loginEmail, setLoginEmail] = useState('socio@gym.local')
  const [loginPassword, setLoginPassword] = useState('demo1234')

  // Register fields: Simple initial account creation
  const [fullName, setFullName] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
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
    setSubmitting(true)
    try {
      await repo.signIn({ email: loginEmail, password: loginPassword })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBiometricLogin() {
    setError('')
    setSubmitting(true)
    try {
      const bioAuth = await authenticateWithBiometrics()
      // Try to sign in with standard demo pass or saved session
      try {
        await repo.signIn({ email: bioAuth.email, password: 'demo1234' })
      } catch {
        // In local mock or custom credentials, sign in with found email
        await repo.signIn({ email: bioAuth.email, password: loginPassword || 'demo1234' })
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
    setSubmitting(true)

    try {
      await repo.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        fullName: fullName.trim(),
      })
      // Flag in sessionStorage so the onboarding Ficha Técnica modal triggers automatically
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('just_signed_up', 'true')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar la cuenta')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4 py-10">
      <Card className="w-full max-w-lg space-y-6 p-6 sm:p-8">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.name}
              className="h-11 w-11 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-acc text-white shadow-md shadow-acc/20 font-black">
              <Dumbbell className="h-6 w-6" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-extrabold text-ink tracking-tight">
              {settings.name || 'Zona Cero'}
            </h1>
            <p className="text-xs text-ink-3">
              Centro de Rendimiento · Reservas & Entrenamiento
            </p>
          </div>
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
                ? 'bg-acc text-white font-bold shadow-xs'
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
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
              mode === 'register'
                ? 'bg-acc text-white font-bold shadow-xs'
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
                        {bioUser ? `Hola, ${bioUser.fullName.split(' ')[0]}` : 'Acceso Biométrico'}
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
                <span>Acceso rápido demo (desarrollo):</span>
                <span className="text-[10px] text-acc font-mono">demo1234</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('socio@gym.local')
                    setLoginPassword('demo1234')
                  }}
                  className="rounded-xl border border-line bg-surface/60 px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:border-acc/40 transition"
                >
                  Socio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('staff@gym.local')
                    setLoginPassword('demo1234')
                  }}
                  className="rounded-xl border border-line bg-surface/60 px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:border-acc/40 transition"
                >
                  Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginEmail('admin@gym.local')
                    setLoginPassword('demo1234')
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
                Luego de crear tu cuenta, completarás tu ficha técnica antropométrica (peso,
                estatura y metas).
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
              {submitting ? 'Creando cuenta…' : 'Crear cuenta y completar Ficha Técnica'}
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
