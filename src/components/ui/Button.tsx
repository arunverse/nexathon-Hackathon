import { cn } from '../../lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'surface'
  size?: 'sm' | 'md'
  icon?: string
}

export function Button({ variant = 'primary', size = 'md', icon, children, className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-all active:opacity-80 cursor-pointer',
        {
          'bg-primary text-on-primary hover:brightness-110': variant === 'primary',
          'border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container': variant === 'ghost',
          'bg-surface-container text-on-surface hover:bg-surface-container-high': variant === 'surface',
          'px-3 py-1.5 text-[14px]': size === 'sm',
          'px-4 py-2 text-[14px]': size === 'md',
        },
        className
      )}
      {...props}
    >
      {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
      {children}
    </button>
  )
}
