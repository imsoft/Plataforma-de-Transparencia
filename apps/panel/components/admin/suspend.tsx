'use client'
import { Button } from '@platform/ui/components/button'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { toggleMunicipalityPanel } from '@/actions/admin'

export function SuspendButton({
  municipalityId,
  suspended,
}: {
  municipalityId: string
  suspended: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await toggleMunicipalityPanel(municipalityId, !suspended)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast(
            suspended
              ? 'Panel reactivado'
              : 'Panel suspendido. El sitio público sigue funcionando.',
          )
          router.refresh()
        })
      }
    >
      {suspended ? 'Reactivar panel' : 'Suspender panel'}
    </Button>
  )
}
