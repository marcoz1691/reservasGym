import { useState, useEffect, type FormEvent } from 'react'
import {
  User as UserIcon,
  Mail,
  Calendar,
  Ruler,
  Scale,
  Target,
  HeartPulse,
  Trash2,
  Check,
  AlertCircle,
  Activity,
  Fingerprint,
  FileSpreadsheet,
} from 'lucide-react'
import { useCurrentUser, useGym, useRefresh } from '@/data/RepositoryProvider'
import {
  disableBiometrics,
  getSavedBiometricUser,
  isBiometricsEnabled,
  registerBiometrics,
} from '@/lib/biometrics'
import { Badge, Button, Card, Input, PageHeader } from '@/ui/primitives'
import { DeleteAccountModal } from './DeleteAccountModal'
import { FichaTecnicaModal } from './FichaTecnicaModal'

export function ProfilePage() {
  const user = useCurrentUser()
  const { repo } = useGym()
  const refresh = useRefresh()

  const [isEditing, setIsEditing] = useState(false)
  const [fichaModalOpen, setFichaModalOpen] = useState(false)
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? '')
  const [residence, setResidence] = useState(user?.residence ?? '')
  const [heightCm, setHeightCm] = useState(user?.heightCm?.toString() ?? '')
  const [goals, setGoals] = useState(user?.goals ?? '')
  const [healthNotes, setHealthNotes] = useState(user?.healthNotes ?? '')

  const [bioActive, setBioActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (user) {
      const isBioOn = isBiometricsEnabled()
      const bioUser = getSavedBiometricUser()
      setBioActive(isBioOn && bioUser?.userId === user.id)
    }
  }, [user])

  if (!user) {
    return (
      <div className="p-4 text-center text-ink-3">
        Inicia sesión para ver tu perfil.
      </div>
    )
  }

  // Calculate BMI if height and initial weight are available
  const heightM = user.heightCm ? user.heightCm / 100 : null
  const bmi =
    heightM && user.initialWeightKg
      ? (user.initialWeightKg / (heightM * heightM)).toFixed(1)
      : null

  async function handleToggleBiometrics() {
    if (!user) return
    if (bioActive) {
      disableBiometrics()
      setBioActive(false)
      setSuccessMsg('Acceso biométrico deshabilitado para este dispositivo')
    } else {
      const paired = await registerBiometrics({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      })
      if (!paired) {
        setErrorMsg('Este dispositivo no confirmó la biometría.')
        return
      }
      setBioActive(true)
      setSuccessMsg('Face ID / Huella configurada exitosamente para inicio de sesión')
    }
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (repo.updateProfile) {
        await repo.updateProfile({
          fullName: fullName.trim(),
          birthDate: birthDate.trim() || undefined,
          residence: residence.trim() || undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          goals: goals.trim() || undefined,
          healthNotes: healthNotes.trim() || undefined,
        })
      }
      await refresh()
      setSuccessMsg('Perfil actualizado correctamente')
      setIsEditing(false)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al guardar los cambios',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Mi Perfil"
        subtitle="Información de cuenta, ficha antropométrica y seguridad biométrica"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setFichaModalOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold"
            >
              <FileSpreadsheet className="h-4 w-4 text-acc" />
              <span>Ficha Técnica Completa</span>
            </Button>
            {!isEditing ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setFullName(user.fullName)
                  setBirthDate(user.birthDate ?? '')
                  setResidence(user.residence ?? '')
                  setHeightCm(user.heightCm?.toString() ?? '')
                  setGoals(user.goals ?? '')
                  setHealthNotes(user.healthNotes ?? '')
                  setIsEditing(true)
                }}
              >
                Editar datos
              </Button>
            ) : null}
          </div>
        }
      />

      {successMsg ? (
        <div className="flex items-center gap-2 rounded-2xl border border-acc/40 bg-acc/10 p-3.5 text-xs text-ink font-semibold">
          <Check className="h-4 w-4 text-acc" />
          <span>{successMsg}</span>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="flex items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger font-semibold">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      {/* Hero card / User Summary */}
      <Card className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-gradient-to-br from-bg-2 to-surface/40 p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-acc text-[var(--color-acc-contrast)] font-extrabold text-2xl shadow-lg shadow-acc/20">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold text-ink">{user.fullName}</h2>
            <Badge tone={user.role === 'admin' ? 'warn' : user.role === 'staff' ? 'ok' : 'neutral'}>
              {user.role === 'member' ? 'Socio' : user.role === 'staff' ? 'Staff' : 'Administrador'}
            </Badge>
          </div>
          <p className="text-xs text-ink-3 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            {user.email}
          </p>
        </div>
      </Card>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-3">
            <Ruler className="h-4 w-4 text-acc" />
            <span>Estatura</span>
          </div>
          <div className="text-2xl font-extrabold text-ink">
            {user.heightCm ? `${user.heightCm} cm` : '—'}
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-3">
            <Scale className="h-4 w-4 text-acc" />
            <span>Peso inicial</span>
          </div>
          <div className="text-2xl font-extrabold text-ink">
            {user.initialWeightKg ? `${user.initialWeightKg} kg` : '—'}
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-3">
            <Activity className="h-4 w-4 text-acc" />
            <span>IMC inicial</span>
          </div>
          <div className="text-2xl font-extrabold text-ink">
            {bmi ? bmi : '—'}
          </div>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink-3">
            <Calendar className="h-4 w-4 text-acc" />
            <span>Nacimiento</span>
          </div>
          <div className="text-sm font-extrabold text-ink truncate mt-1">
            {user.birthDate || '—'}
          </div>
        </Card>
      </div>

      {/* Biometric Security Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-acc/15 text-acc">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                Seguridad Biométrica (Face ID / Huella)
              </h3>
              <p className="text-xs text-ink-3">
                {bioActive
                  ? 'Acceso biométrico activado en este dispositivo.'
                  : 'Habilita Face ID o huella dactilar para iniciar sesión sin escribir tu clave.'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant={bioActive ? 'secondary' : 'primary'}
            onClick={handleToggleBiometrics}
            className="flex items-center gap-2 text-xs font-bold"
          >
            <Fingerprint className="h-4 w-4" />
            <span>{bioActive ? 'Desactivar Biometría' : 'Activar Face ID / Huella'}</span>
          </Button>
        </div>
      </Card>

      {/* Detail information / Edit Form */}
      {isEditing ? (
        <Card className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <h3 className="text-base font-extrabold text-ink">Editar datos personales</h3>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nombre completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <Input
                label="Fecha de nacimiento"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />

              <Input
                label="Residencia / Ciudad"
                value={residence}
                onChange={(e) => setResidence(e.target.value)}
                placeholder="Ej. Quito, Cumbayá"
              />

              <Input
                label="Estatura (cm)"
                type="number"
                min="50"
                max="250"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="Ej. 175"
              />
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
                Objetivos de entrenamiento
              </span>
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                rows={2}
                placeholder="Ej. Ganancia de masa muscular, resistencia, perder 5kg"
                className="focus-ring w-full rounded-2xl border border-line bg-bg-2 px-3.5 py-2.5 text-ink text-sm outline-none placeholder:text-ink-3"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-3">
                Dolencias o notas médicas / de salud
              </span>
              <textarea
                value={healthNotes}
                onChange={(e) => setHealthNotes(e.target.value)}
                rows={2}
                placeholder="Ej. Lesión en hombro izquierdo, asmático, molestia lumbar"
                className="focus-ring w-full rounded-2xl border border-line bg-bg-2 px-3.5 py-2.5 text-ink text-sm outline-none placeholder:text-ink-3"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditing(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Card className="p-5 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3 flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-acc" />
              Datos personales
            </h3>
            <div className="space-y-2.5 text-sm">
              <div>
                <span className="text-xs text-ink-3 block">Residencia:</span>
                <span className="font-semibold text-ink">
                  {user.residence || 'No registrada'}
                </span>
              </div>
              <div>
                <span className="text-xs text-ink-3 block">Fecha de nacimiento:</span>
                <span className="font-semibold text-ink">
                  {user.birthDate || 'No registrada'}
                </span>
              </div>
              <div>
                <span className="text-xs text-ink-3 block">Miembro desde:</span>
                <span className="font-semibold text-ink">
                  {new Date(user.createdAt).toLocaleDateString('es-EC', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-5 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-3 flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-acc" />
              Ficha de salud y metas
            </h3>
            <div className="space-y-2.5 text-sm">
              <div>
                <span className="text-xs text-ink-3 block flex items-center gap-1">
                  <Target className="h-3 w-3" /> Objetivos:
                </span>
                <p className="font-medium text-ink mt-0.5 text-xs leading-relaxed">
                  {user.goals || 'Sin objetivos especificados'}
                </p>
              </div>
              <div>
                <span className="text-xs text-ink-3 block flex items-center gap-1">
                  <HeartPulse className="h-3 w-3" /> Dolencias / Notas médicas:
                </span>
                <p className="font-medium text-ink mt-0.5 text-xs leading-relaxed">
                  {user.healthNotes || 'Sin dolencias ni observaciones registradas'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Apple 5.1.1(v) & Google Data Safety: Account Deletion UI */}
      <Card className="border-danger/30 bg-danger/5 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-extrabold text-ink flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-danger" />
              Privacidad y eliminación de cuenta
            </h3>
            <p className="mt-1 text-xs text-ink-2 max-w-xl leading-relaxed">
              De acuerdo con las normativas de privacidad (Apple Guideline 5.1.1(v) y Google Data Safety), puedes solicitar la eliminación completa y permanente de tu cuenta, historial de reservas, mediciones corporales y datos de salud en cualquier momento.
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={() => setDeleteModalOpen(true)}
            className="gap-2 shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar mi cuenta y mis datos
          </Button>
        </div>
      </Card>

      <FichaTecnicaModal
        open={fichaModalOpen}
        onClose={() => setFichaModalOpen(false)}
      />

      <DeleteAccountModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  )
}
