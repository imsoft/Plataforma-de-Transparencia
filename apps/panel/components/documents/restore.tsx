'use client'
import { Button } from '@platform/ui/components/button'
import { RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { changeDocumentStatus } from '@/actions/documents'

export function RestoreButton({ slug, id }: { slug: string; id: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await changeDocumentStatus(slug, id, 'published')
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
