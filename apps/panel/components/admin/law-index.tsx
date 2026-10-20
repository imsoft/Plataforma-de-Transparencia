'use client'
import { Button } from '@platform/ui/components/button'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { loadLawIndexFromRepo, publishLawIndexVersion } from '@/actions/admin'

export function LoadLawIndex({ files }: { files: { folder: string; files: string[] }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const options = files.flatMap((c) => c.files.map((a) => `${c.folder}/${a}`))
  const [chosen, setChosen] = useState(options[0] ?? '')
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
      <label className="flex flex-col gap-1 text-sm">
        Archivo del repositorio
        <select
          value={chosen}
          onChange={(e) => setChosen(e.target.value)}
          className="h-11 min-w-64 rounded-md border bg-background px-3"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <Button
        className="h-11"
        disabled={pending || !chosen}
        onClick={() =>
          start(async () => {
            const [folder, file] = chosen.split('/') as [string, string]
            const r = await loadLawIndexFromRepo(folder, file)
            if (!r.ok) {
              toast.error(r.error, { duration: 12000 })
              return
            }
            toast.success(
              `Índice cargado: ${r.data.created} nuevos, ${r.data.updated} actualizados, ${r.data.deactivated} desactivados`,
            )
            router.refresh()
          })
        }
      >
        {pending ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <UploadIcon aria-hidden />
        )}{' '}
        Cargar o sincronizar
      </Button>
    </div>
  )
}

export function PublishVersion({ versionId, name }: { versionId: string; name: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `¿Publicar "${name}" como versión vigente? La versión vigente actual pasará a histórica.`,
          )
        )
          return
        start(async () => {
          const r = await publishLawIndexVersion(versionId)
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success('Versión publicada')
          router.refresh()
        })
      }}
    >
      Publicar como vigente
    </Button>
  )
}
