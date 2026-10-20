/**
 * GET /d/<id>: enlace permanente. Montar en `app/d/[id]/route.ts`:
 *   export { GET } from '@platform/transparency/next/document'
 */
import { contentDisposition } from '@platform/files/paths'
import { definition } from '@platform/files/types'
import { isPreviewBot } from '../bots'
import { nodeRoute } from '../routes'
import { siteConfig } from './config'
import { getDocument, getMunicipality } from './data'
import { documentMetadata, subjectName } from './metadata'

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params
  if (!/^[a-z0-9]{6,40}$/i.test(id))
    return page(404, 'Enlace no válido', 'Este enlace no corresponde a ningún documento.', null)
  const [m, d] = await Promise.all([getMunicipality(), getDocument(id)])
  if (!m || !d)
    return page(
      404,
      'Documento no encontrado',
      'Este enlace no corresponde a ningún documento de este municipio. Puede que se haya escrito mal.',
      null,
    )
  const section = nodeRoute(d.prefix, d.node.key, d.node.routeSlug)
  const subject = subjectName(m, d.prefix)

  if (d.status === 'trash')
    return page(
      410,
      'Documento retirado',
      `“${d.name}” fue retirado por ${subject}. Puedes consultar la sección a la que pertenecía.`,
      section,
    )
  if (d.status === 'hidden')
    return page(
      200,
      'Documento no disponible',
      `“${d.name}” no está disponible en este momento. Consulta la sección a la que pertenece.`,
      section,
    )
  if (d.status === 'historical')
    return page(
      200,
      'Documento histórico',
      `“${d.name}” ya no está vigente; se conserva como histórico. Consulta la sección para ver la información actual.`,
      section,
      d.version ? fileUrl(d.version.storagePath) : d.externalUrl,
    )

  // Robots de vista previa (WhatsApp, Facebook…): HTML ligero con Open Graph. Nunca para buscadores (cloaking).
  if (isPreviewBot(req.headers.get('user-agent'))) {
    const meta = documentMetadata(m, d)
    const og = meta.openGraph as {
      title?: string
      description?: string
      url?: string
      siteName?: string
      images?: { url: string; width?: number; height?: number; alt?: string }[]
    }
    const img = og.images?.[0]
    const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${escapeHtml(typeof meta.title === 'string' ? meta.title : d.name)}</title>
<meta property="og:title" content="${escapeHtml(String(og.title))}"><meta property="og:description" content="${escapeHtml(String(og.description))}">
<meta property="og:url" content="${escapeHtml(String(og.url))}"><meta property="og:type" content="article"><meta property="og:site_name" content="${escapeHtml(String(og.siteName))}"><meta property="og:locale" content="es_MX">
${img ? `<meta property="og:image" content="${escapeHtml(img.url)}"><meta property="og:image:width" content="${img.width ?? 1200}"><meta property="og:image:height" content="${img.height ?? 630}"><meta property="og:image:alt" content="${escapeHtml(img.alt ?? '')}">` : ''}
<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escapeHtml(String(og.url))}"></head>
<body><p><a href="${escapeHtml(String(og.url))}">${escapeHtml(d.name)}</a></p></body></html>`
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=3600',
        vary: 'User-Agent',
      },
    })
  }

  if (d.type === 'external_video' || d.version?.fileType === 'video') {
    // los videos tienen página propia con reproductor
    return Response.redirect(`${siteConfig().baseUrl}/d/${d.id}/ver`, 302)
  }
  if (!d.version)
    return page(404, 'Archivo no disponible', 'Este documento no tiene archivo.', section)
  const def = definition(d.version.fileType)
  const ext = d.version.storagePath.split('.').pop() ?? 'pdf'
  return new Response(null, {
    status: 302,
    headers: {
      location: fileUrl(d.version.storagePath),
      'cache-control': 'public, max-age=60, s-maxage=300',
      'x-content-disposition': contentDisposition(def.disposition, d.name, ext),
      vary: 'User-Agent',
    },
  })
}

function fileUrl(path: string): string {
  return `${siteConfig().filesPublicUrl}/${path.split('/').map(encodeURIComponent).join('/')}`
}

function page(
  status: number,
  title: string,
  text: string,
  section: string | null,
  file?: string | null,
): Response {
  const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem 1rem;background:#fafafa;color:#171717}main{max-width:36rem;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:1.5rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{line-height:1.5;color:#404040}a{display:inline-block;margin-top:1rem;margin-right:.75rem;padding:.6rem 1rem;border-radius:8px;background:#171717;color:#fff;text-decoration:none}a.sec{background:#fff;color:#171717;border:1px solid #d4d4d4}</style></head>
<body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>${section ? `<a href="${escapeHtml(section)}">Ver la sección</a>` : `<a href="/">Ir al inicio</a>`}${file ? `<a class="sec" href="${escapeHtml(file)}">Ver de todos modos</a>` : ''}</main></body></html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}
