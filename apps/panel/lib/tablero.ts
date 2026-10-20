import 'server-only'
import { contextoDb, type Sesion } from '@plataforma/auth'
import { conUsuario, desc, documentos, eq } from '@plataforma/db'
import { coberturaPorNodo } from '@plataforma/db/consultas/documentos'
import { nodosDe, versionVigente } from '@plataforma/db/consultas/indice'
import { municipioPorId } from '@plataforma/db/consultas/municipio'
import { todosLosMunicipios } from '@plataforma/db/consultas/sesion'
import type { Estado } from '@plataforma/indice'
import { semaforoDe } from './semaforo'
import type { SesionPanel } from './sesion'

export type Pendiente = {
  sujeto: string
  prefijo: string
  clave: string | null
  rutaSlug: string | null
  titulo: string
  estado: Estado
  periodo: string | null
  vencidos: number
}
export type ResumenMunicipio = {
  id: string
  slug: string
  nombre: string
  nombreOficial: string
  hojas: number
  verdes: number
  amarillos: number
  rojos: number
  /** 0–100 */
  avance: number
  estado: Estado
  ultimaActualizacion: Date | null
  pendientes: Pendiente[]
}

/** Municipios que ve el supervisor (asignados) o el superadmin (todos). */
export async function municipiosDelTablero(sesion: SesionPanel) {
  if (sesion.esSuperadmin) return todosLosMunicipios()
  return sesion.municipios
    .filter((m) => m.rol === 'supervisor' || m.rol === 'admin_municipal')
    .map((m) => m.municipio)
}

export async function resumenDeMunicipio(
  sesion: Sesion,
  municipioId: string,
): Promise<ResumenMunicipio | null> {
  const ctx = contextoDb(sesion, municipioId)
  return conUsuario(ctx, async (tx) => {
    const m = await municipioPorId(tx, municipioId)
    if (!m) return null
    const version = await versionVigente(tx, m.estadoId)
    const pendientes: Pendiente[] = []
    let hojas = 0
    let verdes = 0
    let amarillos = 0
    let rojos = 0
    for (const so of m.sujetosObligados.filter((s) => s.activo)) {
      const nodos = version ? await nodosDe(tx, version.id, so.tipoSujetoId) : []
      const cobertura = await coberturaPorNodo(tx, m.id, so.id)
      const conHijos = new Set(nodos.map((n) => n.padreId).filter(Boolean))
      for (const n of nodos) {
        if (conHijos.has(n.id)) continue
        hojas++
        const r = semaforoDe(n, cobertura.get(n.id))
        if (r.estado === 'verde') verdes++
        else {
          if (r.estado === 'amarillo') amarillos++
          else rojos++
          pendientes.push({
            sujeto: so.prefijo ? so.nombre : 'Ayuntamiento',
            prefijo: so.prefijo,
            clave: n.clave,
            rutaSlug: n.rutaSlug,
            titulo: n.titulo,
            estado: r.estado,
            periodo: r.vencidos[0]?.etiqueta ?? r.periodo?.etiqueta ?? null,
            vencidos: r.vencidos.length,
          })
        }
      }
    }
    const ultimo = await tx.query.documentos.findFirst({
      where: eq(documentos.municipioId, m.id),
      orderBy: [desc(documentos.actualizadoEn)],
      columns: { actualizadoEn: true },
    })
    const avance = hojas === 0 ? 0 : Math.round((verdes / hojas) * 100)
    const estado: Estado =
      hojas === 0
        ? 'rojo'
        : rojos === 0 && amarillos === 0
          ? 'verde'
          : rojos === 0 || avance >= 80
            ? 'amarillo'
            : 'rojo'
    pendientes.sort((a, b) =>
      a.estado === b.estado ? b.vencidos - a.vencidos : a.estado === 'rojo' ? -1 : 1,
    )
    return {
      id: m.id,
      slug: m.slug,
      nombre: m.nombre,
      nombreOficial: m.nombreOficial,
      hojas,
      verdes,
      amarillos,
      rojos,
      avance,
      estado,
      ultimaActualizacion: ultimo?.actualizadoEn ?? null,
      pendientes,
    }
  })
}

export async function tableroCompleto(sesion: SesionPanel): Promise<ResumenMunicipio[]> {
  const lista = await municipiosDelTablero(sesion)
  const r = await Promise.all(lista.map((m) => resumenDeMunicipio(sesion, m.id)))
  return r.filter((x): x is ResumenMunicipio => x !== null).sort((a, b) => a.avance - b.avance)
}
