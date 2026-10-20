import ExcelJS from 'exceljs'
import { getSession } from '@/lib/session'
import { fullDashboard } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'

const STATUS_LABEL = { green: 'Al día', yellow: 'Por vencer', red: 'Atrasado' } as const

/** Reporte Excel del tablero: una hoja de resumen y una con todas las secciones pendientes. */
export async function GET(): Promise<Response> {
  const s = await getSession()
  if (!s || (!s.isSuperadmin && !s.memberships.some((m) => m.role === 'supervisor')))
    return new Response('No autorizado', { status: 401 })
  const rows = await fullDashboard(s)
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Plataforma de Transparencia'
  const summary = workbook.addWorksheet('Resumen')
  summary.columns = [
    { header: 'Municipio', key: 'municipality', width: 36 },
    { header: 'Avance (%)', key: 'avance', width: 12 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Secciones', key: 'hojas', width: 11 },
    { header: 'Al día', key: 'verdes', width: 9 },
    { header: 'Por vencer', key: 'amarillos', width: 11 },
    { header: 'Atrasadas', key: 'rojos', width: 11 },
    { header: 'Última actualización', key: 'ultima', width: 22 },
  ]
  for (const m of rows)
    summary.addRow({
      municipality: m.officialName,
      progressPercent: m.progressPercent,
      status: STATUS_LABEL[m.status],
      leaves: m.leaves,
      greenCount: m.greenCount,
      yellowCount: m.yellowCount,
      redCount: m.redCount,
      last: m.lastUpdate ?? '',
    })
  const pendingSheet = workbook.addWorksheet('Pendientes')
  pendingSheet.columns = [
    { header: 'Municipio', key: 'municipality', width: 30 },
    { header: 'Sujeto obligado', key: 'sujeto', width: 24 },
    { header: 'Clave', key: 'clave', width: 10 },
    { header: 'Sección', key: 'titulo', width: 60 },
    { header: 'Estado', key: 'estado', width: 12 },
    { header: 'Periodo que toca', key: 'periodo', width: 20 },
    { header: 'Periodos vencidos', key: 'vencidos', width: 16 },
  ]
  for (const m of rows)
    for (const p of m.pendingItems)
      pendingSheet.addRow({
        municipality: m.name,
        subject: p.subject,
        key: p.key ?? p.routeSlug,
        title: p.title,
        status: STATUS_LABEL[p.status],
        period: p.period ?? '',
        overdue: p.overdue,
      })
  for (const leaf of [summary, pendingSheet]) {
    leaf.getRow(1).font = { bold: true }
    leaf.views = [{ state: 'frozen', ySplit: 1 }]
    leaf.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: leaf.columns.length } }
  }
  const buffer = await workbook.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)
  return new Response(buffer, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="transparencia-tablero-${date}.xlsx"`,
      'cache-control': 'no-store',
    },
  })
}
