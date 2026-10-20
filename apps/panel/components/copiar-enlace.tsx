'use client'
import { Button } from '@plataforma/ui/components/button'
import { CheckIcon, LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function CopiarEnlace({
  url,
  etiqueta = 'Copiar enlace',
  size = 'sm',
  variant = 'outline',
  soloIcono = false,
}: {
  url: string
  etiqueta?: string
  size?: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm'
  variant?: 'outline' | 'ghost' | 'default' | 'secondary'
  soloIcono?: boolean
}) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      toast.success('¡Enlace copiado!', {
        description: url,
        action: { label: 'Probar', onClick: () => window.open(url, '_blank', 'noopener') },
      })
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.', { description: url })
    }
  }
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={copiar}
      aria-label={soloIcono ? etiqueta : undefined}
      title={url}
    >
      {copiado ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
      {!soloIcono && (copiado ? '¡Copiado!' : etiqueta)}
    </Button>
  )
}
