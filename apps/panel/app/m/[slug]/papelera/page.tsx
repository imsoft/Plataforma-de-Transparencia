import { withUser } from '@platform/db'
import { trash } from '@platform/db/queries/documents'
import type { Metadata } from 'next'
import { FileIcon } from '@/components/file-icon'
import { RestoreButton } from '@/components/documents/restore'
import { shortDate } from '@/lib/dates'
import { municipalityContext } from '@/lib/municipality'

export const metadata: Metadata = { title: 'Papelera' }

export default async function TrashPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await municipalityContext(slug)
  const docs = await withUser(c.ctx, (tx) => trash(tx, c.municipality.id))
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
              <FileIcon
                type={d.currentVersion?.fileType ?? null}
                external={d.type === 'external_video'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.obligatedSubject.prefix ? d.obligatedSubject.name : 'Ayuntamiento'} ·{' '}
                  {d.node.key ?? d.node.routeSlug} · eliminado el {shortDate(d.deletedAt)}
                </p>
              </div>
              {c.can('document:restore', { obligatedSubjectId: d.obligatedSubjectId }) && (
                <RestoreButton slug={slug} id={d.id} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
