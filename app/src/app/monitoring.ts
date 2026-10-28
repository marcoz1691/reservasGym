import type { ErrorEvent } from '@sentry/react'

type SentryCapacitor = typeof import('@sentry/capacitor')

// Se carga solo si hay DSN, para no sumar el SDK al bundle inicial.
let sentry: SentryCapacitor | null = null

export function isMonitoringActive(): boolean {
  return sentry !== null
}

/** Quita datos personales antes de enviar el evento. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies
    delete event.request.headers
  }
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
  }
  return event
}

/**
 * Reporte de errores con Sentry. No hace nada si no hay `VITE_SENTRY_DSN`
 * (desarrollo local, tests, builds sin proyecto creado).
 */
export async function initMonitoring(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || sentry) return

  try {
    const [Sentry, SentryReact] = await Promise.all([
      import('@sentry/capacitor'),
      import('@sentry/react'),
    ])
    Sentry.init(
      {
        dsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        beforeSend: (event) => scrubEvent(event),
      },
      SentryReact.init,
    )
    sentry = Sentry
  } catch (err) {
    console.error('[monitoring] no se pudo iniciar Sentry', err)
  }
}

export function reportError(error: unknown, componentStack?: string | null): void {
  if (!sentry) return
  sentry.captureException(error, componentStack
    ? { contexts: { react: { componentStack } } }
    : undefined)
}
