import { cn } from '../../lib/utils'

interface ProgressBarProps {
  value: number
  height?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, height = 'md', className }: ProgressBarProps) {
  return (
    <div
      className={cn(
        'w-full bg-surface-container-highest rounded-full overflow-hidden',
        height === 'sm' ? 'h-1' : 'h-1.5',
        className
      )}
    >
      <div
        className="h-full bg-primary rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}
