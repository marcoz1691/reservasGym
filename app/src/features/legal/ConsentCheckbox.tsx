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
    <div className="flex flex-wrap items-center gap-x-1 text-sm text-ink-2">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          id={id}
          type="checkbox"
          aria-label={label}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-6 w-6 shrink-0 rounded border-line-strong accent-[var(--color-cta)]"
        />
        <span>{children}</span>
      </label>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-2"
      >
        {linkText}
      </button>
    </div>
  )
}
