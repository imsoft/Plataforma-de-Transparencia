'use client'
import { Button } from '@plataforma/ui/components/button'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { alternarPanelMunicipio } from '@/acciones/admin'

export function BotonSuspender({
  municipioId,
  suspendido,
}: {
  municipioId: string
  suspendido: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          const r = await alternarPanelMunicipio(municipioId, !suspendido)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast(
            suspendido
              ? 'Panel reactivado'
              : 'Panel suspendido. El sitio público sigue funcionando.',
          )
          router.refresh()
        })
      }
    >
      {suspendido ? 'Reactivar panel' : 'Suspender panel'}
    </Button>
  )
}
