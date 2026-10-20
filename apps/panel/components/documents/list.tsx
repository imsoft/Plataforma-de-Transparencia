import type { DocumentWithVersion } from '@platform/db/queries/documents'
import { DocumentRow } from './row'

export function DocumentList({
  slug,
  docs,
  site,
  canEdit,
}: {
  slug: string
  docs: DocumentWithVersion[]
  site: string
  obligatedSubjectId: string
  nodeId: string
  canEdit: boolean
}) {
  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">Todavía no hay documentos en esta sección.</p>
        <p className="text-sm text-muted-foreground">
          Usa el botón "Subir documento" para publicar el primero.
        </p>
      </div>
    )
  }
  return (
    <ul data-testid="document-list" className="divide-y rounded-xl border bg-card">
      {docs.map((d) => (
        <DocumentRow
          key={d.id}
          slug={slug}
          site={site}
          canEdit={canEdit}
          doc={{
            id: d.id,
            name: d.name,
            status: d.status,
            type: d.type,
            fileType: d.currentVersion?.fileType ?? null,
            size: d.currentVersion?.size ?? null,
            periodLabel: d.periodLabel,
            publishedAt: d.publishedAt?.toISOString() ?? d.createdAt.toISOString(),
            externalUrl: d.externalUrl,
          }}
        />
      ))}
    </ul>
  )
}
