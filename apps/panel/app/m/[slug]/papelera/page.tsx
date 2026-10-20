import { conUsuario } from '@plataforma/db'
import { papelera } from '@plataforma/db/consultas/documentos'
import type { Metadata } from 'next'
import { IconoArchivo } from '@/components/icono-archivo'
import { BotonRestaurar } from '@/components/documentos/restaurar'
import { fechaCorta } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Papelera' }

export default async function PaginaPapelera({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await contextoMunicipio(slug)
  const docs = await conUsuario(c.ctx, (tx) => papelera(tx, c.municipio.id))
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Papelera</h1>
        <p className="text-sm text-muted-foreground">
          Nada se borra de verdad: cualquier documento se puede restaurar. Sus enlaces vuelven a
          funcionar al instante.
        </p>
      </div>
      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          La papelera está vacía.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-3">
              <IconoArchivo
                tipo={d.versionActual?.tipoArchivo ?? null}
                externo={d.tipo === 'video_externo'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {d.sujetoObligado.prefijo ? d.sujetoObligado.nombre : 'Ayuntamiento'} ·{' '}
                  {d.nodo.clave ?? d.nodo.rutaSlug} · eliminado el {fechaCorta(d.eliminadoEn)}
                </p>
              </div>
              {c.puede('documento:restaurar', { sujetoObligadoId: d.sujetoObligadoId }) && (
                <BotonRestaurar slug={slug} id={d.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
