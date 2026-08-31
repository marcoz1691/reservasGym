import { useState } from 'react'
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useGym, useRefresh } from '@/data/RepositoryProvider'
import { Button, Input } from '@/ui/primitives'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const { repo } = useGym()
  const refresh = useRefresh()
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isConfirmed = confirmText.trim().toUpperCase() === 'ELIMINAR'

  async function handleDelete() {
    if (!isConfirmed) return

    setLoading(true)
    setError(null)

    try {
      await repo.deleteAccount()
      await refresh()
      onClose()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al eliminar la cuenta',
      )
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setConfirmText('')
    setError(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border border-danger/40 bg-bg-2 p-6 shadow-[0_16px_50px_rgba(255,92,92,0.15)]">
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-ink-3 hover:bg-surface hover:text-ink transition"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/15 text-danger">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-ink">
              Eliminar cuenta y datos personales
            </h2>
            <p className="text-xs text-danger font-semibold">
              Acción permanente e irreversible (Apple 5.1.1 / Google Safety)
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3.5 text-xs text-ink-2">
          <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3.5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>¿Qué información será eliminada?</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-ink-2">
              <li>
                <strong className="text-ink">Datos de perfil:</strong> Nombre, correo, fecha de nacimiento, residencia y objetivos.
              </li>
              <li>
                <strong className="text-ink">Ficha de salud:</strong> Estatura, peso inicial, historial de mediciones y notas de salud/dolencias.
              </li>
              <li>
                <strong className="text-ink">Actividad en el gimnasio:</strong> Todas tus reservas activas, historial de asistencia, check-ins y lista de espera.
              </li>
              <li>
                <strong className="text-ink">Credenciales de acceso:</strong> Tu sesión será cerrada y no podrás volver a ingresar con esta cuenta.
              </li>
            </ul>
          </div>

          <p className="text-ink-3">
            Para confirmar la eliminación permanente de tu cuenta y todos tus datos personales de los servidores de Zona Cero, escribe <strong className="text-danger font-mono font-bold">ELIMINAR</strong> a continuación:
          </p>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Escribe ELIMINAR para confirmar"
            className="border-danger/40 focus-ring font-mono text-center tracking-wider"
            autoFocus
          />

          {error ? (
            <p className="text-xs font-semibold text-danger">{error}</p>
          ) : null}
        </div>

        <div className="mt-6 flex gap-2.5">
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
            type="button"
            variant="danger"
            className="flex-1 gap-2"
            disabled={!isConfirmed || loading}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-4 w-4" />
            {loading ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Button>
        </div>
      </div>
    </div>
  )
}
