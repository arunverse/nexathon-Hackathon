import { cn } from '../../lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'outline'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold leading-[1.2] tracking-[0.06em] uppercase',
        {
          'bg-surface-container text-on-surface-variant border border-outline-variant': variant === 'default',
          'bg-primary-container text-on-primary-container': variant === 'primary',
          'bg-secondary-container/20 text-secondary border border-secondary/30': variant === 'secondary',
          'bg-emerald/10 text-emerald border border-emerald/30': variant === 'success',
          'bg-error-container text-error': variant === 'error',
          'border border-outline-variant text-on-surface-variant': variant === 'outline',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
