import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  InputEvent,
  InvalidEvent,
  KeyboardEvent,
  ClipboardEvent,
  ChangeEvent,
} from 'react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  isBlockedNumberKey,
  sanitizeDecimalInput,
  spanishValidityMessage,
  applyDecimalRangeValidity,
} from '@/lib/formValidationEs'
import {
  buttonClasses,
  type ButtonSize,
  type ButtonVariant,
} from './buttonStyles'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
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
  return (
    <button
      disabled={disabled || isLoading}
      className={`disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 ${buttonClasses(variant, size, className)}`}
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
  onInvalid,
  onInput,
  onKeyDown,
  onPaste,
  onChange,
  type,
  inputMode,
  min,
  max,
  step,
  ...props
}: InputProps) {
  // type=number en Chrome permite y muestra "e" (notación científica).
  // Usamos text + inputMode decimal y validamos min/max nosotros.
  const isNumber = type === 'number'
  const isPassword = type === 'password'
  const [revealed, setRevealed] = useState(false)

  return (
    <label className="block space-y-1.5">
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wider text-ink-3">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <input
          className={`focus-ring w-full rounded-2xl border bg-surface-elevated px-3.5 py-2.5 text-ink outline-none placeholder:text-ink-3 transition-colors duration-150 ease-[var(--ease-out)] focus-visible:border-acc/60 focus-visible:ring-2 focus-visible:ring-acc/20 ${
            error ? 'border-danger/80' : 'border-line'
          } ${isPassword ? 'pr-11' : ''} ${className}`}
          type={isNumber || (isPassword && revealed) ? 'text' : type}
          inputMode={inputMode ?? (isNumber ? 'decimal' : undefined)}
          min={isNumber ? undefined : min}
          max={isNumber ? undefined : max}
          step={isNumber ? undefined : step}
          data-zc-decimal={isNumber ? 'true' : undefined}
          {...props}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (isNumber && isBlockedNumberKey(e.key)) {
              e.preventDefault()
              return
            }
            onKeyDown?.(e)
          }}
          onBeforeInput={(e) => {
            if (!isNumber) return
            const data = e.nativeEvent.data
            if (data && /[eE+\-]|[^\d.]/.test(data)) {
              e.preventDefault()
            }
          }}
          onPaste={(e: ClipboardEvent<HTMLInputElement>) => {
            if (isNumber) {
              const text = e.clipboardData.getData('text')
              e.preventDefault()
              const cleaned = sanitizeDecimalInput(text)
              const el = e.currentTarget
              const start = el.selectionStart ?? el.value.length
              const end = el.selectionEnd ?? el.value.length
              const next = sanitizeDecimalInput(
                el.value.slice(0, start) + cleaned + el.value.slice(end),
              )
              const native = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
              )
              native?.set?.call(el, next)
              applyDecimalRangeValidity(el, min, max)
              el.dispatchEvent(new Event('input', { bubbles: true }))
              onChange?.({
                ...e,
                target: el,
                currentTarget: el,
              } as ChangeEvent<HTMLInputElement>)
              return
            }
            onPaste?.(e)
          }}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            if (isNumber) {
              const cleaned = sanitizeDecimalInput(e.target.value)
              if (cleaned !== e.target.value) {
                e.target.value = cleaned
              }
              applyDecimalRangeValidity(e.target, min, max)
            }
            onChange?.(e)
          }}
          onInvalid={(e: InvalidEvent<HTMLInputElement>) => {
            if (isNumber) {
              applyDecimalRangeValidity(e.currentTarget, min, max)
              if (!e.currentTarget.validity.customError) {
                e.currentTarget.setCustomValidity(
                  spanishValidityMessage(e.currentTarget),
                )
              }
            } else {
              e.currentTarget.setCustomValidity(
                spanishValidityMessage(e.currentTarget),
              )
            }
            onInvalid?.(e)
          }}
          onInput={(e: InputEvent<HTMLInputElement>) => {
            if (isNumber) {
              applyDecimalRangeValidity(e.currentTarget, min, max)
            } else {
              e.currentTarget.setCustomValidity('')
            }
            onInput?.(e)
          }}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // Sin esto el label roba el foco del campo al pulsar el ojo.
            onMouseDown={(e) => e.preventDefault()}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={revealed}
            className="focus-ring absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl p-2 text-ink-3 transition-colors hover:text-ink"
          >
            {revealed ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
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
  onInvalid,
  onInput,
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
        onInvalid={(e: InvalidEvent<HTMLSelectElement>) => {
          e.currentTarget.setCustomValidity(
            spanishValidityMessage(e.currentTarget),
          )
          onInvalid?.(e)
        }}
        onInput={(e: InputEvent<HTMLSelectElement>) => {
          e.currentTarget.setCustomValidity('')
          onInput?.(e)
        }}
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
  onInvalid,
  onInput,
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
        onInvalid={(e: InvalidEvent<HTMLTextAreaElement>) => {
          e.currentTarget.setCustomValidity(
            spanishValidityMessage(e.currentTarget),
          )
          onInvalid?.(e)
        }}
        onInput={(e: InputEvent<HTMLTextAreaElement>) => {
          e.currentTarget.setCustomValidity('')
          onInput?.(e)
        }}
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
      className={`rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-out)] ${className}`}
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
  // Pares fondo tenue + texto oscuro, como las pills de las maquetas.
  const tones = {
    neutral: 'bg-surface-elevated text-ink-2 border border-line',
    ok: 'bg-success-soft text-success',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
    accent: 'bg-acc-soft text-acc',
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
      className={`animate-pulse rounded-2xl bg-ink/[0.06] ${className}`}
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
