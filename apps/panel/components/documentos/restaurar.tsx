'use client'
import { Button } from '@plataforma/ui/components/button'
import { RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { cambiarEstadoDocumento } from '@/acciones/documentos'

export function BotonRestaurar({ slug, id }: { slug: string; id: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await cambiarEstadoDocumento(slug, id, 'publicado')
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success('Documento restaurado y publicado de nuevo')
          router.refresh()
        })
      }
    >
      <RotateCcwIcon aria-hidden /> Restaurar
    </Button>
  )
}
