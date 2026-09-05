import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/ui/primitives'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Captura errores de render de cualquier parte del árbol y muestra una
 * pantalla de recuperación con la marca, en vez de dejar el lienzo en blanco.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Punto único para enviar a un servicio de monitoreo más adelante.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReload = () => {
    this.setState({ error: null })
    window.location.assign('/')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-elevated text-danger">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-extrabold text-ink">
            Algo se rompió
          </h1>
          <p className="mx-auto max-w-sm text-sm text-ink-3 leading-relaxed">
            Ocurrió un error inesperado en la aplicación. Puedes volver al inicio
            y reintentar; tus datos no se han perdido.
          </p>
        </div>
        {import.meta.env.DEV ? (
          <pre className="max-w-md overflow-x-auto rounded-2xl border border-line bg-surface p-3 text-left text-xs text-ink-2">
            {error.message}
          </pre>
        ) : null}
        <Button variant="primary" onClick={this.handleReload}>
          <RotateCcw className="h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    )
  }
}
