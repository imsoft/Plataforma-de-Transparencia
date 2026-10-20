/**
 * Imágenes para tarjetas al compartir (1200×630). Montar en `app/og/[...ruta]/route.tsx`.
 * URLs: /og/nodo/<prefijo|raiz>/<clave|portada>-<v>.png · /og/d/<id>-<v>-<h>.png
 */
import { ImageResponse } from 'next/og'
import { temaSchema, tokensDeTema } from '@plataforma/tema'
import { obtenerDocumento, obtenerMunicipio, obtenerNodo, type MunicipioPublico } from './datos'
import { configSitio } from './config'
import { nombreSujeto, tituloDeRuta } from './metadatos'

const TIPO_ETIQUETA: Record<string, string> = {
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
  powerpoint: 'PowerPoint',
  zip: 'ZIP',
  video: 'Video',
  imagen: 'Imagen',
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ ruta: string[] }> },
): Promise<Response> {
  const { ruta } = await ctx.params
  const m = await obtenerMunicipio()
  if (!m || ruta.length < 2) return new Response('No encontrado', { status: 404 })
  const archivo = ruta[ruta.length - 1]!.replace(/\.png$/, '')

  if (ruta[0] === 'd') {
    const id = archivo.split('-')[0]!
    const d = await obtenerDocumento(id)
    if (!d || d.estado !== 'publicado') return new Response('No encontrado', { status: 404 })
    return tarjeta(m, {
      sujeto: nombreSujeto(m, d.prefijo),
      titulo: d.nombre,
      detalle: tituloDeRuta(d.ruta),
      periodo: d.periodoEtiqueta,
      clave: d.nodo.clave ? conPuntos(d.nodo.clave) : null,
      pie: d.publicadoEn
        ? `Publicado el ${new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d.publicadoEn))}`
        : '',
      tipo:
        d.tipo === 'video_externo'
          ? 'Video'
          : d.version
            ? TIPO_ETIQUETA[d.version.tipoArchivo]!
            : null,
    })
  }

  if (ruta[0] === 'nodo' && ruta.length === 3) {
    const prefijo = ruta[1] === 'raiz' ? '' : ruta[1]!
    const claveORuta = archivo.replace(/-[a-z0-9]+-[a-z0-9]+$/, '')
    if (claveORuta === 'portada') {
      return tarjeta(m, {
        sujeto: nombreSujeto(m, prefijo),
        titulo: 'Transparencia',
        detalle: 'Información fundamental',
        periodo: null,
        clave: null,
        pie: m.version?.nombre ?? '',
        tipo: null,
      })
    }
    const n = await obtenerNodo(prefijo, claveORuta)
    if (!n) return new Response('No encontrado', { status: 404 })
    return tarjeta(m, {
      sujeto: nombreSujeto(m, prefijo),
      titulo: n.nodo.titulo,
      detalle: tituloDeRuta(n.ruta),
      periodo: null,
      clave: n.nodo.clave ? conPuntos(n.nodo.clave) : null,
      pie: `${n.documentos.length} documento${n.documentos.length === 1 ? '' : 's'}`,
      tipo: null,
    })
  }
  return new Response('No encontrado', { status: 404 })
}

function conPuntos(clave: string): string {
  const m = /^(\d+)(\d)?([a-z])?(\d+)?$/.exec(clave)
  return m ? [m[1], m[2], m[3], m[4]].filter(Boolean).join('.') : clave
}

type Datos = {
  sujeto: string
  titulo: string
  detalle: string
  periodo: string | null
  clave: string | null
  pie: string
  tipo: string | null
}

function tarjeta(m: MunicipioPublico, d: Datos): Response {
  const tema = temaSchema.safeParse(m.tema ?? {})
  const t = tokensDeTema(
    tema.success
      ? tema.data
      : {
          colorPrimario: '#1e40af',
          colorSecundario: '#0f766e',
          colorAcento: '#b45309',
          tipografia: 'Inter',
        },
  )
  const escudo = m.tema?.escudoRuta
    ? `${configSitio().archivosUrlPublica}/${m.tema.escudoRuta}`
    : null
  const titulo = d.titulo.length > 90 ? `${d.titulo.slice(0, 89)}…` : d.titulo
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
      <div style={{ height: 14, background: t.primarioLegible, display: 'flex' }} />
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', padding: '44px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {escudo ? (
            <img src={escudo} width={88} height={88} style={{ objectFit: 'contain' }} alt="" />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: 16,
                background: t.primarioLegible,
                color: t.sobrePrimario,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 44,
                fontWeight: 700,
              }}
            >
              {m.nombre.slice(0, 1)}
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
              {d.sujeto}
            </div>
            <div style={{ fontSize: 22, color: '#737373' }}>Transparencia</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginTop: 56, flex: 1 }}>
          {d.tipo && (
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 20,
                background: t.primarioSuave,
                color: t.primarioLegible,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {d.tipo}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
            <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1.15 }}>{titulo}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {d.detalle && (
                <div
                  style={{
                    fontSize: 24,
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: t.primarioSuave,
                    color: t.primarioLegible,
                  }}
                >
                  {d.detalle}
                </div>
              )}
              {d.periodo && (
                <div
                  style={{
                    fontSize: 24,
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: '#f5f5f5',
                    color: '#404040',
                  }}
                >
                  {d.periodo}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div
            style={{ fontSize: 64, fontWeight: 800, color: t.primarioLegible, letterSpacing: -1 }}
          >
            {d.clave ?? ''}
          </div>
          <div style={{ fontSize: 22, color: '#737373' }}>{d.pie}</div>
        </div>
      </div>
      <div style={{ height: 14, background: t.secundarioLegible, display: 'flex' }} />
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
  )
}
