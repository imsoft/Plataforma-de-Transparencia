/**
 * Imágenes para tarjetas al compartir (1200×630). Montar en `app/og/[...ruta]/route.tsx`.
 * URLs: /og/nodo/<prefijo|raiz>/<clave|portada>-<v>.png · /og/d/<id>-<v>-<h>.png
 */
import { ImageResponse } from 'next/og'
import { themeSchema, themeTokens } from '@platform/theme'
import { getDocument, getMunicipality, getNode, type PublicMunicipality } from './data'
import { siteConfig } from './config'
import { subjectName, pathTitle } from './metadata'

const TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  zip: 'ZIP',
  video: 'Video',
  image: 'Imagen',
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await ctx.params
  const m = await getMunicipality()
  if (!m || path.length < 2) return new Response('No encontrado', { status: 404 })
  const file = path[path.length - 1]!.replace(/\.png$/, '')

  if (path[0] === 'd') {
    const id = file.split('-')[0]!
    const d = await getDocument(id)
    if (!d || d.status !== 'published') return new Response('No encontrado', { status: 404 })
    return card(m, {
      subject: subjectName(m, d.prefix),
      title: d.name,
      detail: pathTitle(d.path),
      period: d.periodLabel,
      key: d.node.key ? dotted(d.node.key) : null,
      footer: d.publishedAt
        ? `Publicado el ${new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d.publishedAt))}`
        : '',
      type:
        d.type === 'external_video' ? 'Video' : d.version ? TYPE_LABEL[d.version.fileType]! : null,
    })
  }

  if (path[0] === 'nodo' && path.length === 3) {
    const prefix = path[1] === 'raiz' ? '' : path[1]!
    const keyOrSlug = file.replace(/-[a-z0-9]+-[a-z0-9]+$/, '')
    if (keyOrSlug === 'home') {
      return card(m, {
        subject: subjectName(m, prefix),
        title: 'Transparencia',
        detail: 'Información fundamental',
        period: null,
        key: null,
        footer: m.version?.name ?? '',
        type: null,
      })
    }
    const n = await getNode(prefix, keyOrSlug)
    if (!n) return new Response('No encontrado', { status: 404 })
    return card(m, {
      subject: subjectName(m, prefix),
      title: n.node.title,
      detail: pathTitle(n.path),
      period: null,
      key: n.node.key ? dotted(n.node.key) : null,
      footer: `${n.documents.length} documento${n.documents.length === 1 ? '' : 's'}`,
      type: null,
    })
  }
  return new Response('No encontrado', { status: 404 })
}

function dotted(key: string): string {
  const m = /^(\d+)(\d)?([a-z])?(\d+)?$/.exec(key)
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join('.') : key
}

type CardData = {
  subject: string
  title: string
  detail: string
  period: string | null
  key: string | null
  footer: string
  type: string | null
}

function card(m: PublicMunicipality, d: CardData): Response {
  const theme = themeSchema.safeParse(m.theme ?? {})
  const t = themeTokens(
    theme.success
      ? theme.data
      : {
          primaryColor: '#1e40af',
          secondaryColor: '#0f766e',
          accentColor: '#b45309',
          typeface: 'Inter',
        },
  )
  const coatOfArms = m.theme?.coatOfArmsPath
    ? `${siteConfig().filesPublicUrl}/${m.theme.coatOfArmsPath}`
    : null
  const title = d.title.length > 90 ? `${d.title.slice(0, 89)}…` : d.title
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        fontFamily: 'sans-serif',
        color: '#171717',
      }}
    >
      <div style={{ height: 14, background: t.primaryReadable, display: 'flex' }} />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: '44px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {coatOfArms ? (
            <img src={coatOfArms} width={88} height={88} style={{ objectFit: 'contain' }} alt="" />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 16,
                background: t.primaryReadable,
                color: t.onPrimary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 44,
                fontWeight: 700,
              }}
            >
              {m.name.slice(0, 1)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1,
                color: '#404040',
              }}
            >
              {d.subject}
            </div>
            <div style={{ fontSize: 22, color: '#737373' }}>Transparencia</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 56, flex: 1 }}>
          {d.type && (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 20,
                background: t.primarySoft,
                color: t.primaryReadable,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {d.type}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
            <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {d.detail && (
                <div
                  style={{
                    fontSize: 24,
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: t.primarySoft,
                    color: t.primaryReadable,
                  }}
                >
                  {d.detail}
                </div>
              )}
              {d.period && (
                <div
                  style={{
                    fontSize: 24,
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: '#f5f5f5',
                    color: '#404040',
                  }}
                >
                  {d.period}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div
            style={{ fontSize: 64, fontWeight: 800, color: t.primaryReadable, letterSpacing: -1 }}
          >
            {d.key ?? ''}
          </div>
          <div style={{ fontSize: 22, color: '#737373' }}>{d.footer}</div>
        </div>
      </div>
      <div style={{ height: 14, background: t.secondaryReadable, display: 'flex' }} />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  )
}
