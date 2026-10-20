'use client'
import { Button } from '@platform/ui/components/button'
import { ArchiveIcon, Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { requestExport } from '@/actions/exports'

export function ExportButton({ slug }: { slug: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      className="h-11"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await requestExport(slug)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success('Exportación en marcha. Te llegará un correo con el enlace cuando termine.')
          router.refresh()
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <ArchiveIcon aria-hidden />}{' '}
      Generar exportación
    </Button>
  )
}
