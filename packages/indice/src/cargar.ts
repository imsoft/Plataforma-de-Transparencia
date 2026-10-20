/**
 * Carga una versión del índice (archivo JSON validado) en la base de datos.
 * - Versión en `borrador`: sincroniza (upsert por clave / rutaSlug, desactiva lo que ya no está).
 * - Versión `vigente` u `historica`: solo permite cambiar título/descripción; la estructura es inmutable.
 * Corre dentro de una transacción con contexto (comoSistema o conUsuario del superadmin).
 */
import { and, eq, inArray, isNull, type Tx } from '@plataforma/db'
import { estados, indiceNodos, indiceVersiones, tiposSujetoObligado } from '@plataforma/db/schema'
import { validarIndice } from './validar'

export type ResultadoCarga = {
  versionId: string
  tipoSujetoId: string
  creados: number
  actualizados: number
  desactivados: number
}

export class ErrorIndice extends Error {
  constructor(public readonly errores: string[]) {
    super(`El índice tiene ${errores.length} error(es):\n- ${errores.join('\n- ')}`)
    this.name = 'ErrorIndice'
  }
}

export async function cargarIndice(
  tx: Tx,
  entrada: unknown,
  opciones: { nombreTipo?: string } = {},
): Promise<ResultadoCarga> {
  const r = validarIndice(entrada)
  if (!r.ok) throw new ErrorIndice(r.errores)
  const { archivo, nodos } = r

  const estado = await tx.query.estados.findFirst({ where: eq(estados.clave, archivo.estado) })
  if (!estado)
    throw new ErrorIndice([`No existe el estado "${archivo.estado}" en la base de datos`])

  let tipo = await tx.query.tiposSujetoObligado.findFirst({
    where: eq(tiposSujetoObligado.slug, archivo.tipoSujetoObligado),
  })
  if (!tipo) {
    ;[tipo] = await tx
      .insert(tiposSujetoObligado)
      .values({
        slug: archivo.tipoSujetoObligado,
        nombre: opciones.nombreTipo ?? capitalizar(archivo.tipoSujetoObligado),
      })
      .returning()
  }

  let version = await tx.query.indiceVersiones.findFirst({
    where: and(
      eq(indiceVersiones.estadoId, estado.id),
      eq(indiceVersiones.slug, archivo.version.slug),
    ),
  })
  if (!version) {
    ;[version] = await tx
      .insert(indiceVersiones)
      .values({
        estadoId: estado.id,
        slug: archivo.version.slug,
        nombre: archivo.version.nombre,
        fechaVigencia: archivo.version.vigenciaDesde ?? null,
        carpetaR2: archivo.version.slug,
        estatus: 'borrador',
      })
      .returning()
  }
  const estructuraInmutable = version!.estatus !== 'borrador'

  const existentes = await tx.query.indiceNodos.findMany({
    where: and(eq(indiceNodos.versionId, version!.id), eq(indiceNodos.tipoSujetoId, tipo!.id)),
  })
  const llaveDe = (n: { clave: string | null; rutaSlug: string | null; carpetaR2: string }) =>
    n.clave ?? n.rutaSlug ?? `carpeta:${n.carpetaR2}`
  const porLlave = new Map(existentes.map((n) => [llaveDe(n), n]))

  let creados = 0
  let actualizados = 0
  const idsPorIndice: string[] = []
  const vistos = new Set<string>()

  for (const n of nodos) {
    const llave = llaveDe(n)
    vistos.add(llave)
    const padreId = n.padreIndice === null ? null : idsPorIndice[n.padreIndice]!
    const previo = porLlave.get(llave)
    const valores = {
      padreId,
      nivel: n.nivel,
      numero: n.numero,
      etiqueta: n.etiqueta,
      titulo: n.titulo,
      descripcion: n.descripcion,
      clave: n.clave,
      rutaSlug: n.rutaSlug,
      periodicidad: n.periodicidad,
      periodicidadPorConfirmar: n.periodicidadPorConfirmar,
      carpetaR2: n.carpetaR2,
      orden: n.orden,
      activo: true,
    }
    if (!previo) {
      if (estructuraInmutable)
        throw new ErrorIndice([
          `${n.ruta}: no se pueden agregar nodos a una versión ${version!.estatus}`,
        ])
      const [creado] = await tx
        .insert(indiceNodos)
        .values({ versionId: version!.id, tipoSujetoId: tipo!.id, ...valores })
        .returning()
      idsPorIndice.push(creado!.id)
      creados++
      continue
    }
    idsPorIndice.push(previo.id)
    const cambiaEstructura =
      previo.padreId !== padreId ||
      previo.nivel !== n.nivel ||
      previo.periodicidad !== n.periodicidad ||
      previo.carpetaR2 !== n.carpetaR2
    if (estructuraInmutable && cambiaEstructura) {
      throw new ErrorIndice([
        `${n.ruta}: cambia la estructura de una versión ${version!.estatus} (crea una versión nueva)`,
      ])
    }
    const cambia =
      cambiaEstructura ||
      previo.titulo !== n.titulo ||
      previo.descripcion !== n.descripcion ||
      previo.orden !== n.orden ||
      previo.etiqueta !== n.etiqueta ||
      !previo.activo
    if (cambia) {
      await tx.update(indiceNodos).set(valores).where(eq(indiceNodos.id, previo.id))
      actualizados++
    }
  }

  const sobrantes = existentes.filter((n) => !vistos.has(llaveDe(n)) && n.activo).map((n) => n.id)
  if (sobrantes.length > 0) {
    if (estructuraInmutable)
      throw new ErrorIndice([
        `Faltan ${sobrantes.length} nodos que ya existen en una versión ${version!.estatus}`,
      ])
    await tx
      .update(indiceNodos)
      .set({ activo: false })
      .where(and(inArray(indiceNodos.id, sobrantes), isNull(indiceNodos.padreId)))
    await tx.update(indiceNodos).set({ activo: false }).where(inArray(indiceNodos.id, sobrantes))
  }

  return {
    versionId: version!.id,
    tipoSujetoId: tipo!.id,
    creados,
    actualizados,
    desactivados: sobrantes.length,
  }
}

/** Marca una versión como vigente (y la anterior vigente como histórica). */
export async function publicarVersion(tx: Tx, versionId: string): Promise<void> {
  const v = await tx.query.indiceVersiones.findFirst({ where: eq(indiceVersiones.id, versionId) })
  if (!v) throw new Error('Versión no encontrada')
  await tx
    .update(indiceVersiones)
    .set({ estatus: 'historica' })
    .where(and(eq(indiceVersiones.estadoId, v.estadoId), eq(indiceVersiones.estatus, 'vigente')))
  await tx
    .update(indiceVersiones)
    .set({ estatus: 'vigente', publicadaEn: new Date() })
    .where(eq(indiceVersiones.id, versionId))
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
