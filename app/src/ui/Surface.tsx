import type { PropsWithChildren } from 'react'

export function Surface({
  children,
  className = '',
}: PropsWithChildren<{ className?: string; onClick?: () => void }>) {
  return <div className={`surface p-4 ${className}`}>{children}</div>
}
