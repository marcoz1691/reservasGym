import { useNavigate } from 'react-router-dom'
import { FichaTecnicaModal } from './FichaTecnicaModal'
import { markFichaSkipped } from './fichaOnboarding'

/**
 * Primer ingreso del socio: vive fuera de AppLayout para que no haya barra de
 * navegación por donde salir sin completar la ficha.
 */
export function WelcomeFichaPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg">
      <FichaTecnicaModal
        open
        isInitialOnboarding
        onClose={() => navigate('/', { replace: true })}
        onSkip={() => {
          markFichaSkipped()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}
