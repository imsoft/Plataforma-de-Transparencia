import { Badge } from '@plataforma/ui/components/badge'
import type { Metadata } from 'next'
import { listarArchivosIndice, listarVersiones } from '@/acciones/admin'
import { CargarIndice, PublicarVersion } from '@/components/admin/indice'
import { fechaCorta } from '@/lib/fechas'

export const metadata: Metadata = { title: 'Índice de la ley' }

export default async function PaginaIndice() {
  const [versiones, archivos] = await Promise.all([listarVersiones(), listarArchivosIndice()])
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Índice de la ley</h1>
        <p className="text-sm text-muted-foreground">
          Las versiones se cargan desde los archivos JSON del repositorio y se publican aquí. La
          estructura de una versión publicada no cambia: para la ley nueva se crea otra versión.
        </p>
      </div>
      <CargarIndice archivos={archivos.ok ? archivos.datos : []} />
      <ul className="divide-y rounded-xl border bg-card">
        {versiones.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {v.nombre}{' '}
                <Badge variant={v.estatus === 'vigente' ? 'default' : 'secondary'}>
                  {v.estatus}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {v.estado.nombre} · {v.slug} · {v.nodos.length} nodos en{' '}
                {new Set(v.nodos.map((n) => n.tipoSujetoId)).size} tipos de sujeto · creada el{' '}
                {fechaCorta(v.creadaEn)}
              </p>
            </div>
            {v.estatus === 'borrador' && <PublicarVersion versionId={v.id} nombre={v.nombre} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
