import type { Zone } from '@/domain/models'
import { getDisciplineMeta } from '@/domain/disciplines'
import { areaImageUrl } from '../areaImages'

interface AreaThumbProps {
  zone?: Zone | null
  /** Se usa cuando la zona no está cargada y solo se tiene el id de la sesión. */
  zoneId?: string
  /** Tamaño del recuadro; por defecto 48px. */
  className?: string
  iconClassName?: string
}

/**
 * Portada de un área. Con foto en `src/assets/areas/` la muestra recortada;
 * sin foto cae a un tile duotono de marca, que ocupa el mismo espacio para que
 * el layout no cambie cuando se suban las imágenes.
 */
export function AreaThumb({
  zone,
  zoneId,
  className = 'h-12 w-12',
  iconClassName = 'h-5 w-5',
}: AreaThumbProps) {
  const key = zone?.type ?? zoneId ?? ''
  const meta = getDisciplineMeta(key)
  const Icon = meta.icon
  const src = areaImageUrl(zone?.imageHint, zone?.type, zone?.id ?? zoneId)

  return (
    <span
      className={`relative isolate flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink ring-1 ring-inset ring-white/10 ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#2E2825] via-[#1C1917] to-[#141110]"
          />
          <span
            aria-hidden
            className="absolute -right-2 -top-2 h-8 w-8 rounded-full bg-acc/30 blur-lg"
          />
          <Icon aria-hidden className={`relative z-10 text-white/90 ${iconClassName}`} />
        </>
      )}
    </span>
  )
}
