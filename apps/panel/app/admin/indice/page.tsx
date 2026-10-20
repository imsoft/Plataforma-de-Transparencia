import { Badge } from '@platform/ui/components/badge'
import type { Metadata } from 'next'
import { listLawIndexFiles, listVersions } from '@/actions/admin'
import { LoadLawIndex, PublishVersion } from '@/components/admin/law-index'
import { shortDate } from '@/lib/dates'

export const metadata: Metadata = { title: 'Índice de la ley' }

export default async function LawIndexPage() {
  const [versions, files] = await Promise.all([listVersions(), listLawIndexFiles()])
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Índice de la ley</h1>
        <p className="text-sm text-muted-foreground">
          Las versiones se cargan desde los archivos JSON del repositorio y se publican aquí. La
          estructura de una versión publicada no cambia: para la ley nueva se crea otra versión.
        </p>
      </div>
      <LoadLawIndex files={files.ok ? files.data : []} />
      <ul className="divide-y rounded-xl border bg-card">
        {versions.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {v.name}{' '}
                <Badge variant={v.status === 'current' ? 'default' : 'secondary'}>{v.status}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {v.state.name} · {v.slug} · {v.nodes.length} nodos en{' '}
                {new Set(v.nodes.map((n) => n.subjectTypeId)).size} tipos de sujeto · creada el{' '}
                {shortDate(v.createdAt)}
              </p>
            </div>
            {v.status === 'draft' && <PublishVersion versionId={v.id} name={v.name} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
