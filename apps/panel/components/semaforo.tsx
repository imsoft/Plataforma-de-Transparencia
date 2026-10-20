import type { Estado } from '@plataforma/indice'
import { cn } from '@plataforma/ui/lib/utils'

const ESTILO: Record<Estado, { punto: string; texto: string }> = {
  verde: { punto: 'bg-green-600', texto: 'Al día' },
  amarillo: { punto: 'bg-amber-500', texto: 'Por vencer' },
  rojo: { punto: 'bg-red-600', texto: 'Atrasado' },
}

export function Semaforo({
  estado,
  conTexto = false,
  className,
}: {
  estado: Estado
  conTexto?: boolean
  className?: string
}) {
  const e = ESTILO[estado]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}
    >
      <span className={cn('size-2.5 rounded-full', e.punto)} aria-hidden />
      <span className={conTexto ? '' : 'sr-only'}>{e.texto}</span>
    </span>
  )
}
