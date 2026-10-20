'use client'
import { Button } from '@platform/ui/components/button'
import { CheckIcon, LinkIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function CopyLink({
  url,
  label = 'Copiar enlace',
  size = 'sm',
  variant = 'outline',
  iconOnly = false,
}: {
  url: string
  label?: string
  size?: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm'
  variant?: 'outline' | 'ghost' | 'default' | 'secondary'
  iconOnly?: boolean
}) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('¡Enlace copiado!', {
        description: url,
        action: { label: 'Probar', onClick: () => window.open(url, '_blank', 'noopener') },
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.', { description: url })
    }
  }
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={copy}
      aria-label={iconOnly ? label : undefined}
      title={url}
    >
      {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
      {!iconOnly && (copied ? '¡Copiado!' : label)}
    </Button>
  )
}
