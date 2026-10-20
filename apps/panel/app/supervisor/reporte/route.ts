import ExcelJS from 'exceljs'
import { obtenerSesion } from '@/lib/sesion'
import { tableroCompleto } from '@/lib/tablero'

export const dynamic = 'force-dynamic'

const ESTADO = { verde: 'Al día', amarillo: 'Por vencer', rojo: 'Atrasado' } as const

/** Reporte Excel del tablero: una hoja de resumen y una con todas las secciones pendientes. */
export async function GET(): Promise<Response> {
  const s = await obtenerSesion()
  if (!s || (!s.esSuperadmin && !s.membresias.some((m) => m.rol === 'supervisor')))
    return new Response('No autorizado', { status: 401 })
  const filas = await tableroCompleto(s)
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Plataforma de Transparencia'
  const resumen = libro.addWorksheet('Resumen')
  resumen.columns = [
    { header: 'Municipio', key: 'municipio', width: 36 },
    { header: 'Avance (%)', key: 'avance', width: 12 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Secciones', key: 'hojas', width: 11 },
    { header: 'Al día', key: 'verdes', width: 9 },
    { header: 'Por vencer', key: 'amarillos', width: 11 },
    { header: 'Atrasadas', key: 'rojos', width: 11 },
    { header: 'Última actualización', key: 'ultima', width: 22 },
  ]
  for (const m of filas)
    resumen.addRow({
      municipio: m.nombreOficial,
      avance: m.avance,
      estado: ESTADO[m.estado],
      hojas: m.hojas,
      verdes: m.verdes,
      amarillos: m.amarillos,
      rojos: m.rojos,
      ultima: m.ultimaActualizacion ?? '',
    })
  const pend = libro.addWorksheet('Pendientes')
  pend.columns = [
    { header: 'Municipio', key: 'municipio', width: 30 },
    { header: 'Sujeto obligado', key: 'sujeto', width: 24 },
    { header: 'Clave', key: 'clave', width: 10 },
    { header: 'Sección', key: 'titulo', width: 60 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Periodo que toca', key: 'periodo', width: 20 },
    { header: 'Periodos vencidos', key: 'vencidos', width: 16 },
  ]
  for (const m of filas)
    for (const p of m.pendientes)
      pend.addRow({
        municipio: m.nombre,
        sujeto: p.sujeto,
        clave: p.clave ?? p.rutaSlug,
        titulo: p.titulo,
        estado: ESTADO[p.estado],
        periodo: p.periodo ?? '',
        vencidos: p.vencidos,
      })
  for (const hoja of [resumen, pend]) {
    hoja.getRow(1).font = { bold: true }
    hoja.views = [{ state: 'frozen', ySplit: 1 }]
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columns.length } }
  }
  const buffer = await libro.xlsx.writeBuffer()
  const fecha = new Date().toISOString().slice(0, 10)
  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="transparencia-tablero-${fecha}.xlsx"`,
      'cache-control': 'no-store',
    },
  })
}
