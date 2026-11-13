import { useId, type ReactNode } from 'react'

/**
 * Casilla de aceptación de un documento legal. Cada documento va en su propia casilla
 * (LOPDP: consentimiento específico); el enlace abre el documento sin salir del formulario.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  label,
  linkText,
  onOpen,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Nombre accesible completo de la casilla. */
  label: string
  /** Texto antes del enlace, p. ej. "Acepto los". */
  children: ReactNode
  linkText: string
  onOpen: () => void
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm text-ink-2">
      <input
        id={id}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-line-strong accent-[var(--color-cta)]"
      />
      <p className="min-w-0 leading-relaxed">
        <label htmlFor={id} className="cursor-pointer">
          {children}
        </label>{' '}
        <button
          type="button"
          onClick={onOpen}
          className="inline font-semibold text-ink underline underline-offset-2"
        >
          {linkText}
        </button>
      </p>
    </div>
  )
}
