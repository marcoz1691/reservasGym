import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/network'

/** Aviso fijo bajo la cabecera mientras el dispositivo no tiene conexión. */
export function OfflineBanner() {
  const online = useOnlineStatus()

  // La región viva existe siempre para que el lector de pantalla anuncie el cambio.
  return (
    <div role="status" aria-live="polite" className="shrink-0">
      {online ? null : (
        <div className="flex items-center justify-center gap-2 border-b border-line bg-warn-soft px-4 py-2 text-center text-xs font-semibold text-warn">
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Sin conexión. Algunas acciones no están disponibles.</span>
        </div>
      )}
    </div>
  )
}
