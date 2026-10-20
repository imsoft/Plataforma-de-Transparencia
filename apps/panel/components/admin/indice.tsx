'use client'
import { Button } from '@plataforma/ui/components/button'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cargarIndiceDesdeRepo, publicarVersionIndice } from '@/acciones/admin'

export function CargarIndice({
  archivos,
}: {
  archivos: { carpeta: string; archivos: string[] }[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const opciones = archivos.flatMap((c) => c.archivos.map((a) => `${c.carpeta}/${a}`))
  const [elegido, setElegido] = useState(opciones[0] ?? '')
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4">
      <label className="flex flex-col gap-1 text-sm">
        Archivo del repositorio
        <select
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
          className="h-11 min-w-64 rounded-md border bg-background px-3"
        >
          {opciones.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
      <Button
        className="h-11"
        disabled={pendiente || !elegido}
        onClick={() =>
          iniciar(async () => {
            const [carpeta, archivo] = elegido.split('/') as [string, string]
            const r = await cargarIndiceDesdeRepo(carpeta, archivo)
            if (!r.ok) {
              toast.error(r.error, { duration: 12000 })
              return
            }
            toast.success(
              `Índice cargado: ${r.datos.creados} nuevos, ${r.datos.actualizados} actualizados, ${r.datos.desactivados} desactivados`,
            )
            router.refresh()
          })
        }
      >
        {pendiente ? (
          <Loader2Icon className="animate-spin" aria-hidden />
        ) : (
          <UploadIcon aria-hidden />
        )}{' '}
        Cargar o sincronizar
      </Button>
    </div>
  )
}

export function PublicarVersion({ versionId, nombre }: { versionId: string; nombre: string }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <Button
      variant="outline"
      disabled={pendiente}
      onClick={() => {
        if (
          !window.confirm(
            `¿Publicar "${nombre}" como versión vigente? La versión vigente actual pasará a histórica.`,
          )
        )
          return
        iniciar(async () => {
          const r = await publicarVersionIndice(versionId)
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
