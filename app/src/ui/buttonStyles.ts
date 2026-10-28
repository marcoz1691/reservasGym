export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'outline'
  | 'accent'

export type ButtonSize = 'sm' | 'md' | 'lg'

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-cta text-cta-contrast font-bold hover:bg-cta-hi active:scale-[0.97] shadow-sm border border-transparent disabled:opacity-50 disabled:shadow-none',
  accent:
    'bg-cta text-cta-contrast font-bold hover:bg-cta-hi active:scale-[0.97] shadow-sm border border-transparent disabled:opacity-50',
  secondary:
    'bg-surface-elevated text-ink border border-line hover:border-acc/40 hover:bg-surface active:scale-[0.97] disabled:opacity-50',
  outline:
    'bg-transparent text-ink border border-line hover:border-acc/60 hover:bg-acc-soft active:scale-[0.97] disabled:opacity-50',
  ghost:
    'bg-transparent text-ink-2 hover:bg-surface hover:text-ink active:scale-[0.97] disabled:opacity-50',
  danger:
    'bg-danger text-white font-bold hover:brightness-110 active:scale-[0.97] shadow-md shadow-danger/20 disabled:opacity-50',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
  lg: 'px-5 py-3 text-base rounded-2xl gap-2.5',
}

/** Estilo compartido por `Button` y por los CTA que navegan (`ButtonLink`). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  return `focus-ring inline-flex cursor-pointer items-center justify-center font-semibold transition-[transform,background-color,border-color,box-shadow,filter] duration-150 ease-[var(--ease-out)] select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`
}
