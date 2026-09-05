import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '@/ui/primitives'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg py-8">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Página no encontrada"
        description="La ruta que intentaste abrir no existe o cambió de lugar."
        action={
          <Link to="/">
            <Button variant="primary">Ir al inicio</Button>
          </Link>
        }
      />
    </div>
  )
}
