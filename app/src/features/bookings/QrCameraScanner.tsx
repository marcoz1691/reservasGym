import { useEffect, useRef, useState } from 'react'
import type QrScanner from 'qr-scanner'
import { Button } from '@/ui/primitives'

type Props = {
  /** Texto leído del QR. El escáner se cierra después de una lectura. */
  onResult: (text: string) => void
  onClose: () => void
  /** La cámara no se pudo abrir (sin permiso o sin cámara). */
  onUnavailable?: () => void
}

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : typeof err === 'string' ? err : ''
  if (name === 'NotAllowedError' || /permission|denied/i.test(String(err))) {
    return 'No hay permiso para usar la cámara. Actívalo en los ajustes del teléfono o del navegador.'
  }
  if (name === 'NotFoundError' || /no camera/i.test(String(err))) {
    return 'No se encontró una cámara en este equipo.'
  }
  return 'No se pudo abrir la cámara. Escribe el código o usa un lector QR.'
}

/**
 * Lector QR con la cámara para recepción. La librería se carga solo al abrir,
 * así no pesa en el resto de la app.
 */
export function QrCameraScanner({ onResult, onClose, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onResultRef = useRef(onResult)
  const onUnavailableRef = useRef(onUnavailable)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    onResultRef.current = onResult
    onUnavailableRef.current = onUnavailable
  }, [onResult, onUnavailable])

  useEffect(() => {
    let scanner: QrScanner | null = null
    let cancelled = false
    let done = false

    void (async () => {
      try {
        const { default: QrScannerLib } = await import('qr-scanner')
        if (cancelled || !videoRef.current) return
        scanner = new QrScannerLib(
          videoRef.current,
          (result) => {
            if (done) return
            const text = result.data.trim()
            if (!text) return
            done = true
            scanner?.stop()
            onResultRef.current(text)
          },
          {
            returnDetailedScanResult: true,
            preferredCamera: 'environment',
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 8,
          },
        )
        await scanner.start()
        if (cancelled) {
          scanner.destroy()
          scanner = null
          return
        }
        setStarting(false)
      } catch (err) {
        if (!cancelled) {
          setStarting(false)
          setError(cameraErrorMessage(err))
          onUnavailableRef.current?.()
        }
      }
    })()

    return () => {
      cancelled = true
      scanner?.destroy()
      scanner = null
    }
  }, [])

  return (
    <div className="space-y-3" data-testid="qr-camera-scanner">
      <div className="relative overflow-hidden rounded-2xl bg-ink">
        <video
          ref={videoRef}
          className="aspect-[4/3] max-h-[60vh] w-full object-cover"
          muted
          playsInline
          aria-label="Vista de la cámara para leer el QR"
        />
        {starting && !error ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">
            Abriendo cámara…
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-acc-dark" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-ink-3">Apunta al QR del socio.</p>
      )}
      <Button variant="ghost" onClick={onClose}>
        Apagar cámara
      </Button>
    </div>
  )
}
