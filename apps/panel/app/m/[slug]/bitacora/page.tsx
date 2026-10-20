import { and, bitacora as tabla, conUsuario, desc, eq, gte, lte, sql } from '@plataforma/db'
import { Button } from '@plataforma/ui/components/button'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fechaHora } from '@/lib/fechas'
import { contextoMunicipio } from '@/lib/municipio'

export const metadata: Metadata = { title: 'Bitácora' }

const ACCION: Record<string, string> = {
  crear: 'Creó',
  renombrar: 'Renombró',
  reemplazar: 'Reemplazó archivo',
  reordenar: 'Reordenó',
  cambiar_periodo: 'Cambió periodo',
  ocultar: 'Ocultó',
  historico: 'Mandó a histórico',
  papelera: 'Mandó a papelera',
  restaurar: 'Restauró',
  publicar: 'Publicó',
  actualizar: 'Actualizó',
  eliminar: 'Eliminó',
  marcar_leyenda: 'Marcó "sin información"',
  desmarcar_leyenda: 'Quitó "sin información"',
  cambiar_rol: 'Cambió rol',
}
const ENTIDAD: Record<string, string> = {
  documento: 'documento',
  documento_version: 'versión de archivo',
  leyenda: 'leyenda',
  red_social: 'red social',
  sujeto_obligado: 'sujeto obligado',
  tema: 'identidad',
  municipio: 'municipio',
  dominio: 'dominio',
  alcance: 'alcance',
  miembro: 'usuario',
  invitacion: 'invitación',
  exportacion: 'exportación',
}

type Filtros = {
  usuario?: string
  accion?: string
  desde?: string
  hasta?: string
  pagina?: string
}

export default async function PaginaBitacora({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Filtros>
}) {
  const { slug } = await params
  const f = await searchParams
  const c = await contextoMunicipio(slug)
  if (!c.puede('bitacora:ver')) notFound()
  const pagina = Math.max(1, Number(f.pagina ?? 1) || 1)
  const porPagina = 50
  const condiciones = [eq(tabla.municipioId, c.municipio.id)]
  if (f.usuario) condiciones.push(sql`${tabla.actorId} ILIKE ${'%' + f.usuario + '%'}`)
  if (f.accion) condiciones.push(eq(tabla.accion, f.accion))
  if (f.desde && /^\d{4}-\d{2}-\d{2}$/.test(f.desde))
    condiciones.push(gte(tabla.ocurridoEn, new Date(`${f.desde}T00:00:00-06:00`)))
  if (f.hasta && /^\d{4}-\d{2}-\d{2}$/.test(f.hasta))
    condiciones.push(lte(tabla.ocurridoEn, new Date(`${f.hasta}T23:59:59-06:00`)))
  const filas = await conUsuario(c.ctx, (tx) =>
    tx
      .select()
      .from(tabla)
      .where(and(...condiciones))
      .orderBy(desc(tabla.ocurridoEn))
      .limit(porPagina + 1)
      .offset((pagina - 1) * porPagina),
  )
  const haySiguiente = filas.length > porPagina
  const lista = filas.slice(0, porPagina)
  const qs = (p: number) => {
    const u = new URLSearchParams({
      ...(f.usuario ? { usuario: f.usuario } : {}),
      ...(f.accion ? { accion: f.accion } : {}),
      ...(f.desde ? { desde: f.desde } : {}),
      ...(f.hasta ? { hasta: f.hasta } : {}),
      pagina: String(p),
    })
    return `?${u.toString()}`
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Bitácora</h1>
        <p className="text-sm text-muted-foreground">
          Todo movimiento queda registrado y nadie puede borrarlo ni editarlo, ni siquiera el
          superadministrador.
        </p>
      </div>
      <form className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-5">
        <div className="flex flex-col gap-1">
          <Label htmlFor="usuario">Usuario</Label>
          <Input
            id="usuario"
            name="usuario"
            defaultValue={f.usuario ?? ''}
            placeholder="id o nombre"
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="accion">Acción</Label>
          <select
            id="accion"
            name="accion"
            defaultValue={f.accion ?? ''}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {Object.entries(ACCION).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="desde">Desde</Label>
          <Input
            id="desde"
            name="desde"
            type="date"
            defaultValue={f.desde ?? ''}
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input
            id="hasta"
            name="hasta"
            type="date"
            defaultValue={f.hasta ?? ''}
            className="h-10"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" className="h-10">
            Filtrar
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-10"
            nativeButton={false}
            render={<Link href="?" />}
          >
            Limpiar
          </Button>
        </div>
      </form>
      {lista.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No hay movimientos con esos filtros.
        </p>
      ) : (
        <ul data-testid="bitacora" className="divide-y rounded-xl border bg-card">
          {lista.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:gap-4"
            >
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-36">
                {fechaHora(b.ocurridoEn)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{b.actorId}</span>
                {b.actorRol && (
                  <span className="text-muted-foreground"> ({b.actorRol})</span>
                )} · {ACCION[b.accion] ?? b.accion} {ENTIDAD[b.entidad] ?? b.entidad}{' '}
                {b.entidad === 'documento' ? (
                  <Link
                    href={`/m/${slug}/documentos/${b.entidadId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {b.entidadId}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {b.entidadId.slice(0, 12)}
                  </span>
                )}
                {b.cambios && b.accion !== 'crear' && (
                  <span className="block text-xs text-muted-foreground">
                    {Object.entries(b.cambios)
                      .filter(([k]) =>
                        [
                          'nombre',
                          'estado',
                          'periodo_etiqueta',
                          'orden',
                          'role',
                          'url',
                          'texto',
                        ].includes(k),
                      )
                      .map(([k, v]) => `${k}: ${mostrar(v.antes)} → ${mostrar(v.despues)}`)
                      .join(' · ')}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        {pagina > 1 ? (
          <Button variant="outline" nativeButton={false} render={<Link href={qs(pagina - 1)} />}>
            Anteriores
          </Button>
        ) : (
          <span />
        )}
        {haySiguiente && (
          <Button variant="outline" nativeButton={false} render={<Link href={qs(pagina + 1)} />}>
            Siguientes
          </Button>
        )}
      </div>
    </div>
  )
}

const mostrar = (v: unknown): string => {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}
