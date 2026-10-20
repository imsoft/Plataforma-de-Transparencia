/**
 * GET /d/<id>: enlace permanente. Montar en `app/d/[id]/route.ts`:
 *   export { GET } from '@plataforma/transparencia/next/documento'
 */
import { contentDisposition } from '@plataforma/archivos/rutas'
import { definicion } from '@plataforma/archivos/tipos'
import { esBotDeVistaPrevia } from '../bots'
import { rutaDeNodo } from '../rutas'
import { configSitio } from './config'
import { obtenerDocumento, obtenerMunicipio } from './datos'
import { metadatosDeDocumento, nombreSujeto } from './metadatos'

const escapar = (s: string) =>
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
    return pagina(404, 'Enlace no válido', 'Este enlace no corresponde a ningún documento.', null)
  const [m, d] = await Promise.all([obtenerMunicipio(), obtenerDocumento(id)])
  if (!m || !d)
    return pagina(
      404,
      'Documento no encontrado',
      'Este enlace no corresponde a ningún documento de este municipio. Puede que se haya escrito mal.',
      null,
    )
  const seccion = rutaDeNodo(d.prefijo, d.nodo.clave, d.nodo.rutaSlug)
  const sujeto = nombreSujeto(m, d.prefijo)

  if (d.estado === 'papelera')
    return pagina(
      410,
      'Documento retirado',
      `“${d.nombre}” fue retirado por ${sujeto}. Puedes consultar la sección a la que pertenecía.`,
      seccion,
    )
  if (d.estado === 'oculto')
    return pagina(
      200,
      'Documento no disponible',
      `“${d.nombre}” no está disponible en este momento. Consulta la sección a la que pertenece.`,
      seccion,
    )
  if (d.estado === 'historico')
    return pagina(
      200,
      'Documento histórico',
      `“${d.nombre}” ya no está vigente; se conserva como histórico. Consulta la sección para ver la información actual.`,
      seccion,
      d.version ? archivoUrl(d.version.rutaR2) : d.urlExterna,
    )

  // Robots de vista previa (WhatsApp, Facebook…): HTML ligero con Open Graph. Nunca para buscadores (cloaking).
  if (esBotDeVistaPrevia(req.headers.get('user-agent'))) {
    const meta = metadatosDeDocumento(m, d)
    const og = meta.openGraph as {
      title?: string
      description?: string
      url?: string
      siteName?: string
      images?: { url: string; width?: number; height?: number; alt?: string }[]
    }
    const img = og.images?.[0]
    const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>${escapar(typeof meta.title === 'string' ? meta.title : d.nombre)}</title>
<meta property="og:title" content="${escapar(String(og.title))}"><meta property="og:description" content="${escapar(String(og.description))}">
<meta property="og:url" content="${escapar(String(og.url))}"><meta property="og:type" content="article"><meta property="og:site_name" content="${escapar(String(og.siteName))}"><meta property="og:locale" content="es_MX">
${img ? `<meta property="og:image" content="${escapar(img.url)}"><meta property="og:image:width" content="${img.width ?? 1200}"><meta property="og:image:height" content="${img.height ?? 630}"><meta property="og:image:alt" content="${escapar(img.alt ?? '')}">` : ''}
<meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${escapar(String(og.url))}"></head>
<body><p><a href="${escapar(String(og.url))}">${escapar(d.nombre)}</a></p></body></html>`
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=3600',
        vary: 'User-Agent',
      },
    })
  }

  if (d.tipo === 'video_externo' || d.version?.tipoArchivo === 'video') {
    // los videos tienen página propia con reproductor
    return Response.redirect(`${configSitio().urlBase}/d/${d.id}/ver`, 302)
  }
  if (!d.version)
    return pagina(404, 'Archivo no disponible', 'Este documento no tiene archivo.', seccion)
  const def = definicion(d.version.tipoArchivo)
  const ext = d.version.rutaR2.split('.').pop() ?? 'pdf'
  return new Response(null, {
    status: 302,
    headers: {
      location: archivoUrl(d.version.rutaR2),
      'cache-control': 'public, max-age=60, s-maxage=300',
      'x-content-disposition': contentDisposition(def.disposicion, d.nombre, ext),
      vary: 'User-Agent',
    },
  })
}

function archivoUrl(ruta: string): string {
  return `${configSitio().archivosUrlPublica}/${ruta.split('/').map(encodeURIComponent).join('/')}`
}

function pagina(
  status: number,
  titulo: string,
  texto: string,
  seccion: string | null,
  archivo?: string | null,
): Response {
  const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapar(titulo)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:2rem 1rem;background:#fafafa;color:#171717}main{max-width:36rem;margin:0 auto;background:#fff;border:1px solid #e5e5e5;border-radius:12px;padding:1.5rem}h1{font-size:1.4rem;margin:0 0 .5rem}p{line-height:1.5;color:#404040}a{display:inline-block;margin-top:1rem;margin-right:.75rem;padding:.6rem 1rem;border-radius:8px;background:#171717;color:#fff;text-decoration:none}a.sec{background:#fff;color:#171717;border:1px solid #d4d4d4}</style></head>
<body><main><h1>${escapar(titulo)}</h1><p>${escapar(texto)}</p>${seccion ? `<a href="${escapar(seccion)}">Ver la sección</a>` : `<a href="/">Ir al inicio</a>`}${archivo ? `<a class="sec" href="${escapar(archivo)}">Ver de todos modos</a>` : ''}</main></body></html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  })
}
