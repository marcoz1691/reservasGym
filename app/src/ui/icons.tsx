import type { SVGProps } from 'react'

/**
 * Barra olímpica cargada, para CrossFit. Lucide no trae ninguna: solo
 * `Dumbbell`, que es una mancuerna y ya la ocupa Gimnasio.
 *
 * Proporciones pensadas para que no se lea como mancuerna: el eje cruza el
 * lienzo entero y los discos se agrupan cerca de los topes, dejando un tramo
 * largo de barra libre al centro. Van rellenos y no contorneados porque con
 * trazo de 2 en un lienzo de 24 el hueco interior se empasta a tamaño real.
 */
export function Barbell({
  className,
  strokeWidth = 2,
  ...props
}: SVGProps<SVGSVGElement> & { strokeWidth?: number | string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Eje, de tope a tope */}
      <path d="M1.6 12h20.8" />
      {/* Discos: el interior más alto, el exterior más pequeño */}
      <rect x="2.6" y="9" width="1.5" height="6" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="5" y="6.5" width="2" height="11" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="17" y="6.5" width="2" height="11" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="19.9" y="9" width="1.5" height="6" rx="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}
