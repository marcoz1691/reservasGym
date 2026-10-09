import { Compass } from 'lucide-react'
import { EmptyState } from '@/ui/primitives'
import { ButtonLink } from '@/ui/ButtonLink'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Página no encontrada"
        description="La ruta que intentaste abrir no existe o cambió de lugar."
        action={
          <ButtonLink to="/" variant="primary">Ir al inicio</ButtonLink>
        }
      />
    </div>
  )
}
