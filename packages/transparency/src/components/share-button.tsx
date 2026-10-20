'use client'
import { CheckIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'

/** Compartir nativo en celular (WhatsApp, etc.) o copiar el enlace en escritorio. */
export function ShareButton({
  url,
  title,
  className = '',
  light = false,
}: {
  url: string
  title: string
  className?: string
  light?: boolean
}) {
  const [copied, setCopied] = useState(false)
  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: title, url })
        return
      } catch {
        /* cancelado */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copia este enlace:', url)
    }
  }
  const style = light
    ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
    : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${style} ${className}`}
    >
      {copied ? (
        <CheckIcon className="size-4" aria-hidden="true" />
      ) : (
        <Share2Icon className="size-4" aria-hidden="true" />
      )}
      {copied ? '¡Enlace copiado!' : 'Compartir'}
    </button>
  )
}
