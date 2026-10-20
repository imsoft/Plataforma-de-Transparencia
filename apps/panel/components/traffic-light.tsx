import type { TrafficLightStatus } from '@platform/law-index'
import { cn } from '@platform/ui/lib/utils'

const STYLE: Record<TrafficLightStatus, { dot: string; text: string }> = {
  green: { dot: 'bg-green-600', text: 'Al día' },
  yellow: { dot: 'bg-amber-500', text: 'Por vencer' },
  red: { dot: 'bg-red-600', text: 'Atrasado' },
}

export function TrafficLight({
  status,
  withText = false,
  className,
}: {
  status: TrafficLightStatus
  withText?: boolean
  className?: string
}) {
  const e = STYLE[status]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
    >
      <span className={cn('size-2.5 rounded-full', e.dot)} aria-hidden />
      <span className={withText ? '' : 'sr-only'}>{e.text}</span>
    </span>
  )
}
