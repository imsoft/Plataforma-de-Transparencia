'use client'
import { Button } from '@plataforma/ui/components/button'
import { ArchiveIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { solicitarExportacion } from '@/acciones/exportaciones'

export function BotonExportar({ slug }: { slug: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <Button
      className="h-11"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await solicitarExportacion(slug)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success('Exportación en marcha. Te llegará un correo con el enlace cuando termine.')
          router.refresh()
        })
      }
    >
      {pendiente ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <ArchiveIcon aria-hidden />
      )}{' '}
      Generar exportación
    </Button>
  )
}
