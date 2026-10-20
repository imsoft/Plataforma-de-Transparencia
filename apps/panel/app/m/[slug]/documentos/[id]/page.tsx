import { signRead, readableSize } from '@platform/files'
import { withUser, auditLog as auditLogTable, desc, eq, and } from '@platform/db'
import { documentById } from '@platform/db/queries/documents'
import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@platform/ui/components/card'
import { ExternalLinkIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CopyLink } from '@/components/copy-link'
import { FileIcon } from '@/components/file-icon'
import { ReplaceFile } from '@/components/documents/replace'
import { dateTime } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'
import { siteBase, panelSegment } from '@/lib/urls'

export const metadata: Metadata = { title: 'Documento' }

const ACTION_LABEL: Record<string, string> = {
  create: 'Se publicó',
  rename: 'Se renombró',
  replace: 'Se reemplazó el archivo',
  reorder: 'Se reordenó',
  change_period: 'Se cambió el periodo',
  hide: 'Se ocultó del sitio',
  archive: 'Se mandó a histórico',
  trash: 'Se mandó a la papelera',
  restore: 'Se restauró',
  publish: 'Se publicó de nuevo',
  update: 'Se actualizó',
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const c = await municipalityContext(slug)
  const data = await withUser(c.ctx, async (tx) => {
    const doc = await documentById(tx, id)
    if (!doc || doc.municipalityId !== c.municipality.id) return null
    const history = await tx
      .select()
      .from(auditLogTable)
      .where(and(eq(auditLogTable.entity, 'document'), eq(auditLogTable.entityId, id)))
      .orderBy(desc(auditLogTable.occurredAt))
      .limit(100)
    return { doc, history }
  })
  if (!data) notFound()
  const { doc, history } = data
  const so = c.municipality.obligatedSubjects.find((x) => x.id === doc.obligatedSubjectId)!
  const site = siteBase(c.municipality)
  const canEdit = c.can('document:replace', {
    obligatedSubjectId: so.id,
    nodePath: [doc.nodeId],
  })
  const fileUrl = doc.currentVersion
    ? await signRead(doc.currentVersion.storagePath)
    : doc.externalUrl

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <FileIcon
            type={doc.currentVersion?.fileType ?? null}
            external={doc.type === 'external_video'}
            className="size-12"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight">{doc.name}</h1>
            <p className="text-sm text-muted-foreground">
              <Link
                href={`/m/${slug}/${panelSegment(so)}/${doc.node.key ?? doc.node.routeSlug}`}
                className="hover:underline"
              >
                {doc.node.key ?? doc.node.routeSlug} · {doc.node.title}
              </Link>
              {doc.periodLabel && ` · ${doc.periodLabel}`}
            </p>
            <p className="mt-1 flex flex-wrap gap-1">
              <Badge variant={doc.status === 'published' ? 'default' : 'secondary'}>
                {doc.status}
              </Badge>
              {doc.currentVersion && (
                <Badge variant="outline">
                  {doc.currentVersion.fileType.toUpperCase()} ·{' '}
                  {readableSize(doc.currentVersion.size)}
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CopyLink url={`${site}/d/${doc.id}`} label="Copiar enlace permanente" />
          {fileUrl && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={fileUrl} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLinkIcon aria-hidden /> Abrir archivo
            </Button>
          )}
          {canEdit && doc.type === 'file' && (
            <ReplaceFile
              slug={slug}
              documentId={doc.id}
              currentName={doc.currentVersion?.originalName ?? ''}
            />
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Versiones del archivo</CardTitle>
          </CardHeader>
          <CardContent>
            {doc.versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este documento es un enlace externo: {doc.externalUrl}
              </p>
            ) : (
              <ul className="divide-y">
                {doc.versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        Versión {v.number}{' '}
                        {v.isCurrent && <Badge variant="secondary">vigente</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.originalName} · {readableSize(v.size)} · {dateTime(v.createdAt)}
                      </p>
                    </div>
                    <ViewVersion path={v.storagePath} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {history.map((h) => (
                <li key={h.id} className="py-2 text-sm">
                  <p className="font-medium">{ACTION_LABEL[h.action] ?? h.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateTime(h.occurredAt)} · {h.actorId} ({h.actorRole ?? 'sistema'})
                  </p>
                  {h.changes && h.action !== 'create' && (
                    <ul className="mt-1 text-xs text-muted-foreground">
                      {Object.entries(h.changes)
                        .filter(([k]) =>
                          ['name', 'status', 'period_label', 'sort_order'].includes(k),
                        )
                        .map(([k, v]) => (
                          <li key={k}>
                            {k}: {display(v.before)} → {display(v.after)}
                          </li>
                        ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
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

async function ViewVersion({ path }: { path: string }) {
  const url = await signRead(path)
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      render={<a href={url} target="_blank" rel="noopener noreferrer" />}
    >
      Ver
    </Button>
  )
}
