import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantStyles: Record<string, string> = {
    primary:
      'bg-acc text-[var(--color-acc-contrast)] font-bold hover:bg-acc-hi active:scale-[0.97] shadow-[var(--shadow-acc)] border border-transparent disabled:opacity-50 disabled:shadow-none',
    accent:
      'bg-acc text-[var(--color-acc-contrast)] font-bold hover:bg-acc-hi active:scale-[0.97] shadow-[var(--shadow-acc)] border border-transparent disabled:opacity-50',
    secondary:
      'bg-surface-elevated text-ink border border-line hover:border-acc/40 hover:bg-surface active:scale-[0.97] disabled:opacity-50',
    outline:
      'bg-transparent text-ink border border-line hover:border-acc/60 hover:bg-acc-soft active:scale-[0.97] disabled:opacity-50',
    ghost:
      'bg-transparent text-ink-2 hover:bg-surface hover:text-ink active:scale-[0.97] disabled:opacity-50',
    danger:
      'bg-danger text-white font-bold hover:brightness-110 active:scale-[0.97] shadow-md shadow-danger/20 disabled:opacity-50',
  }

  const sizeStyles: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs rounded-xl gap-1.5',
    md: 'px-4 py-2.5 text-sm rounded-2xl gap-2',
    lg: 'px-5 py-3 text-base rounded-2xl gap-2.5',
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`focus-ring inline-flex cursor-pointer items-center justify-center font-semibold transition-[transform,background-color,border-color,box-shadow,filter] duration-150 ease-[var(--ease-out)] select-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({
  label,
  error,
  hint,
  className = '',
  ...props
}: InputProps) {
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      ) : null}
      <input
        className={`focus-ring w-full rounded-2xl border bg-surface-elevated px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-3 transition-colors duration-150 ease-[var(--ease-out)] focus-visible:border-acc/60 focus-visible:ring-2 focus-visible:ring-acc/20 ${
          error ? 'border-danger/80' : 'border-line'
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="block text-xs text-ink-3">{hint}</span>
      ) : null}
    </label>
  )
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({
  label,
  error,
  className = '',
  children,
  ...props
}: SelectProps) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      ) : null}
      <select
        className={`focus-ring w-full rounded-2xl border bg-surface-elevated px-3.5 py-2.5 text-ink outline-none transition-colors duration-150 ease-[var(--ease-out)] focus-visible:border-acc/60 focus-visible:ring-2 focus-visible:ring-acc/20 ${
          error ? 'border-danger/80' : 'border-line'
        }`}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : null}
    </label>
  )
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({
  label,
  error,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      ) : null}
      <textarea
        className={`focus-ring w-full rounded-2xl border bg-surface-elevated px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-3 transition-colors duration-150 ease-[var(--ease-out)] focus-visible:border-acc/60 focus-visible:ring-2 focus-visible:ring-acc/20 ${
          error ? 'border-danger/80' : 'border-line'
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : null}
    </label>
  )
}

export function Card({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`ring-hairline rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out)] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
  ...props
}: BadgeProps) {
  const tones = {
    neutral: 'bg-surface-elevated text-ink-2 border border-line',
    ok: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    warn: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    accent: 'bg-acc/15 text-acc border border-acc/30',
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold font-display uppercase tracking-wide ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-3 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  )
}

export function Spinner({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'h-5 w-5 border-2',
    md: 'h-9 w-9 border-2',
    lg: 'h-12 w-12 border-3',
  }

  return (
    <div className={`flex items-center justify-center ${size === 'md' ? 'min-h-[30vh]' : ''} ${className}`}>
      <div
        className={`animate-spin rounded-full border-line border-t-acc [animation-duration:0.6s] ${sizeClasses[size]}`}
      />
    </div>
  )
}

export function Skeleton({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-2xl bg-white/[0.07] ${className}`}
      {...props}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-3xl border border-line bg-surface p-5 space-y-3 ${className}`}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
        {label}
      </span>
      {children}
      {error ? (
        <span className="block text-xs font-medium text-danger">{error}</span>
      ) : null}
    </label>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-8 text-center sm:p-12">
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-36 w-36 rounded-full bg-acc/10 blur-2xl" />
      <div className="relative z-10 flex flex-col items-center">
        {icon ? (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface-elevated text-acc shadow-inner">
            {icon}
          </div>
        ) : (
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-elevated text-acc">
            <span className="h-3 w-3 rounded-full bg-acc animate-ping" />
          </div>
        )}
        <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
        {description ? (
          <p className="mt-2 max-w-md text-sm text-ink-3 leading-relaxed">
            {description}
          </p>
        ) : null}
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  )
}
