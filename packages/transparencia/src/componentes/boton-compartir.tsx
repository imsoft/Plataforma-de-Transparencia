'use client'
import { CheckIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'

/** Compartir nativo en celular (WhatsApp, etc.) o copiar el enlace en escritorio. */
export function BotonCompartir({
  url,
  titulo,
  className = '',
  claro = false,
}: {
  url: string
  titulo: string
  className?: string
  claro?: boolean
}) {
  const [copiado, setCopiado] = useState(false)
  async function compartir() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: titulo, url })
        return
      } catch {
        /* cancelado */
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copia este enlace:', url)
    }
  }
  const estilo = claro
    ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
    : 'border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50'
  return (
    <button
      type="button"
      onClick={compartir}
      className={`inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current ${estilo} ${className}`}
    >
      {copiado ? (
        <CheckIcon className="size-4" aria-hidden="true" />
      ) : (
        <Share2Icon className="size-4" aria-hidden="true" />
      )}
      {copiado ? '¡Enlace copiado!' : 'Compartir'}
    </button>
  )
}
