import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/app/store'
import { Button, Field, Input } from '@/ui/primitives'
import { ForgotPasswordModal } from './ForgotPasswordModal'

export function AuthPage() {
  const user = useAppStore((s) => s.user)
  const signIn = useAppStore((s) => s.signIn)
  const signUp = useAppStore((s) => s.signUp)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)
  const settings = useAppStore((s) => s.state?.settings)
  const navigate = useNavigate()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('socio@gym.local')
  const [password, setPassword] = useState('demo1234')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [residence, setResidence] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [initialWeightKg, setInitialWeightKg] = useState('')
  const [goals, setGoals] = useState('')
  const [healthNotes, setHealthNotes] = useState('')
  const [forgotModalOpen, setForgotModalOpen] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          birthDate: birthDate.trim() || undefined,
          residence: residence.trim() || undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          initialWeightKg: initialWeightKg ? Number(initialWeightKg) : undefined,
          goals: goals.trim() || undefined,
          healthNotes: healthNotes.trim() || undefined,
        })
      }
      navigate('/')
    } catch {
      /* store handles error */
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-4 py-10">
      <div className="surface p-6 md:p-8">
        <p className="text-sm font-semibold text-[var(--color-acc)]">
          {settings?.name ?? 'Zona Cero'}
        </p>
        <h1 className="mt-1 text-3xl font-bold">
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-ink-3)]">
          Demo (solo desarrollo): socio@gym.local / staff@gym.local /
          admin@gym.local — contraseña demo1234.
        </p>
        <form className="mt-6 space-y-3.5" onSubmit={onSubmit}>
          {mode === 'register' ? (
            <>
              <Field label="Nombre completo">
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha de nacimiento">
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </Field>
                <Field label="Residencia / Ciudad">
                  <Input
                    value={residence}
                    onChange={(e) => setResidence(e.target.value)}
                    placeholder="Quito"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Estatura (cm)">
                  <Input
                    type="number"
                    min="50"
                    max="250"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="175"
                  />
                </Field>
                <Field label="Peso inicial (kg)">
                  <Input
                    type="number"
                    step="0.1"
                    min="20"
                    max="300"
                    value={initialWeightKg}
                    onChange={(e) => setInitialWeightKg(e.target.value)}
                    placeholder="70.5"
                  />
                </Field>
              </div>
              <Field label="Objetivos de entrenamiento">
                <Input
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Ej. Hipertrofia, resistencia"
                />
              </Field>
              <Field label="Dolencias / Notas médicas">
                <Input
                  value={healthNotes}
                  onChange={(e) => setHealthNotes(e.target.value)}
                  placeholder="Ej. Lesión en rodilla"
                />
              </Field>
            </>
          ) : null}

          <Field label="Correo electrónico">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu.correo@ejemplo.com"
              required
            />
          </Field>
          <Field label="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </Field>

          {mode === 'login' ? (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs text-[var(--color-acc)] hover:underline font-semibold"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          ) : null}

          {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Espera…' : mode === 'login' ? 'Continuar' : 'Registrarme'}
          </Button>
        </form>
        <button
          type="button"
          className="mt-6 w-full text-sm font-semibold text-[var(--color-acc)]"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
        </button>
      </div>

      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        initialEmail={email}
      />
    </div>
  )
}
