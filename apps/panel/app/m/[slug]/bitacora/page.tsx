import { and, auditLog as table, withUser, desc, eq, gte, lte, sql } from '@platform/db'
import { Button } from '@platform/ui/components/button'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { dateTime } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Bitácora' }

const ACTION_LABEL: Record<string, string> = {
  create: 'Creó',
  rename: 'Renombró',
  replace: 'Reemplazó archivo',
  reorder: 'Reordenó',
  change_period: 'Cambió periodo',
  hide: 'Ocultó',
  archive: 'Mandó a histórico',
  trash: 'Mandó a papelera',
  restore: 'Restauró',
  publish: 'Publicó',
  update: 'Actualizó',
  delete: 'Eliminó',
  mark_notice: 'Marcó "sin información"',
  unmark_notice: 'Quitó "sin información"',
  change_role: 'Cambió rol',
}
const ENTITY_LABEL: Record<string, string> = {
  document: 'documento',
  document_version: 'versión de archivo',
  notice: 'leyenda',
  social_network: 'red social',
  obligated_subject: 'sujeto obligado',
  theme: 'identidad',
  municipality: 'municipio',
  domain: 'dominio',
  scope: 'alcance',
  member: 'usuario',
  invitation: 'invitación',
  export: 'exportación',
}

type Filters = {
  user?: string
  action?: string
  from?: string
  until?: string
  page?: string
}

export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Filters>
}) {
  const { slug } = await params
  const f = await searchParams
  const c = await municipalityContext(slug)
  if (!c.can('auditLog:view')) notFound()
  const page = Math.max(1, Number(f.page ?? 1) || 1)
  const perPage = 50
  const conditions = [eq(table.municipalityId, c.municipality.id)]
  if (f.user) conditions.push(sql`${table.actorId} ILIKE ${'%' + f.user + '%'}`)
  if (f.action) conditions.push(eq(table.action, f.action))
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from))
    conditions.push(gte(table.occurredAt, new Date(`${f.from}T00:00:00-06:00`)))
  if (f.until && /^\d{4}-\d{2}-\d{2}$/.test(f.until))
    conditions.push(lte(table.occurredAt, new Date(`${f.until}T23:59:59-06:00`)))
  const rows = await withUser(c.ctx, (tx) =>
    tx
      .select()
      .from(table)
      .where(and(...conditions))
      .orderBy(desc(table.occurredAt))
      .limit(perPage + 1)
      .offset((page - 1) * perPage),
  )
  const hasNext = rows.length > perPage
  const list = rows.slice(0, perPage)
  const qs = (p: number) => {
    const u = new URLSearchParams({
      ...(f.user ? { user: f.user } : {}),
      ...(f.action ? { action: f.action } : {}),
      ...(f.from ? { from: f.from } : {}),
      ...(f.until ? { until: f.until } : {}),
      page: String(p),
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
          <Label htmlFor="user">Usuario</Label>
          <Input
            id="user"
            name="user"
            defaultValue={f.user ?? ''}
            placeholder="id o nombre"
            className="h-10"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="action">Acción</Label>
          <select
            id="action"
            name="action"
            defaultValue={f.action ?? ''}
            className="h-10 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={f.from ?? ''} className="h-10" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="until">Hasta</Label>
          <Input
            id="until"
            name="until"
            type="date"
            defaultValue={f.until ?? ''}
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
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No hay movimientos con esos filtros.
        </p>
      ) : (
        <ul data-testid="audit-log" className="divide-y rounded-xl border bg-card">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:gap-4"
            >
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-36">
                {dateTime(b.occurredAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{b.actorId}</span>
                {b.actorRole && (
                  <span className="text-muted-foreground"> ({b.actorRole})</span>
                )} · {ACTION_LABEL[b.action] ?? b.action} {ENTITY_LABEL[b.entity] ?? b.entity}{' '}
                {b.entity === 'document' ? (
                  <Link
                    href={`/m/${slug}/documentos/${b.entityId}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {b.entityId}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">
                    {b.entityId.slice(0, 12)}
                  </span>
                )}
                {b.changes && b.action !== 'create' && (
                  <span className="block text-xs text-muted-foreground">
                    {Object.entries(b.changes)
                      .filter(([k]) =>
                        [
                          'name',
                          'status',
                          'period_label',
                          'sort_order',
                          'role',
                          'url',
                          'text',
                        ].includes(k),
                      )
                      .map(([k, v]) => `${k}: ${display(v.before)} → ${display(v.after)}`)
                      .join(' · ')}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between">
        {page > 1 ? (
          <Button variant="outline" nativeButton={false} render={<Link href={qs(page - 1)} />}>
            Anteriores
          </Button>
        ) : (
          <span />
        )}
        {hasNext && (
          <Button variant="outline" nativeButton={false} render={<Link href={qs(page + 1)} />}>
            Siguientes
          </Button>
        )}
      </div>
    </div>
  )
}

const display = (v: unknown): string => {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}
