import type { DocumentoConVersion } from '@plataforma/db/consultas/documentos'
import { FilaDocumento } from './fila'

export function ListaDocumentos({
  slug,
  docs,
  sitio,
  puedeEditar,
}: {
  slug: string
  docs: DocumentoConVersion[]
  sitio: string
  sujetoObligadoId: string
  nodoId: string
  puedeEditar: boolean
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
    <ul data-testid="lista-documentos" className="divide-y rounded-xl border bg-card">
      {docs.map((d) => (
        <FilaDocumento
          key={d.id}
          slug={slug}
          sitio={sitio}
          puedeEditar={puedeEditar}
          doc={{
            id: d.id,
            nombre: d.nombre,
            estado: d.estado,
            tipo: d.tipo,
            tipoArchivo: d.versionActual?.tipoArchivo ?? null,
            tamano: d.versionActual?.tamano ?? null,
            periodoEtiqueta: d.periodoEtiqueta,
            publicadoEn: d.publicadoEn?.toISOString() ?? d.creadoEn.toISOString(),
            urlExterna: d.urlExterna,
          }}
        />
      ))}
    </ul>
  )
}
