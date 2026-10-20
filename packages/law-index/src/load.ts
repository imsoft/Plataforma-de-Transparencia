/**
 * Carga una versión del índice (archivo JSON validado) en la base de datos.
 * - Versión en `borrador`: sincroniza (upsert por clave / rutaSlug, desactiva lo que ya no está).
 * - Versión `vigente` u `historica`: solo permite cambiar título/descripción; la estructura es inmutable.
 * Corre dentro de una transacción con contexto (asSystem o withUser del superadmin).
 */
import { and, eq, inArray, isNull, type Tx } from '@platform/db'
import { states, lawIndexNodes, lawIndexVersions, obligatedSubjectTypes } from '@platform/db/schema'
import { validateLawIndex } from './validate'

export type LoadResult = {
  versionId: string
  subjectTypeId: string
  created: number
  updated: number
  deactivated: number
}

export class LawIndexError extends Error {
  constructor(public readonly errors: string[]) {
    super(`El índice tiene ${errors.length} error(es):\n- ${errors.join('\n- ')}`)
    this.name = 'ErrorIndice'
  }
}

export async function loadLawIndex(
  tx: Tx,
  input: unknown,
  options: { typeName?: string } = {},
): Promise<LoadResult> {
  const r = validateLawIndex(input)
  if (!r.ok) throw new LawIndexError(r.errors)
  const { file, nodes } = r

  const state = await tx.query.states.findFirst({ where: eq(states.key, file.state) })
  if (!state) throw new LawIndexError([`No existe el estado "${file.state}" en la base de datos`])

  let type = await tx.query.obligatedSubjectTypes.findFirst({
    where: eq(obligatedSubjectTypes.slug, file.obligatedSubjectType),
  })
  if (!type) {
    ;[type] = await tx
      .insert(obligatedSubjectTypes)
      .values({
        slug: file.obligatedSubjectType,
        name: options.typeName ?? capitalize(file.obligatedSubjectType),
      })
      .returning()
  }

  let version = await tx.query.lawIndexVersions.findFirst({
    where: and(
      eq(lawIndexVersions.stateId, state.id),
      eq(lawIndexVersions.slug, file.version.slug),
    ),
  })
  if (!version) {
    ;[version] = await tx
      .insert(lawIndexVersions)
      .values({
        stateId: state.id,
        slug: file.version.slug,
        name: file.version.name,
        effectiveDate: file.version.validFrom ?? null,
        storageFolder: file.version.slug,
        status: 'draft',
      })
      .returning()
  }
  const immutableStructure = version!.status !== 'draft'

  const existing = await tx.query.lawIndexNodes.findMany({
    where: and(eq(lawIndexNodes.versionId, version!.id), eq(lawIndexNodes.subjectTypeId, type!.id)),
  })
  const lookupKeyOf = (n: {
    key: string | null
    routeSlug: string | null
    storageFolder: string
  }) => n.key ?? n.routeSlug ?? `carpeta:${n.storageFolder}`
  const byLookupKey = new Map(existing.map((n) => [lookupKeyOf(n), n]))

  let createdCount = 0
  let updated = 0
  const idsByIndex: string[] = []
  const seen = new Set<string>()

  for (const n of nodes) {
    const lookupKey = lookupKeyOf(n)
    seen.add(lookupKey)
    const parentId = n.parentIndex === null ? null : idsByIndex[n.parentIndex]!
    const previous = byLookupKey.get(lookupKey)
    const values = {
      parentId,
      level: n.level,
      number: n.number,
      label: n.label,
      title: n.title,
      description: n.description,
      key: n.key,
      routeSlug: n.routeSlug,
      frequency: n.frequency,
      frequencyToConfirm: n.frequencyToConfirm,
      storageFolder: n.storageFolder,
      order: n.order,
      active: true,
    }
    if (!previous) {
      if (immutableStructure)
        throw new LawIndexError([
          `${n.path}: no se pueden agregar nodos a una versión ${version!.status}`,
        ])
      const [created] = await tx
        .insert(lawIndexNodes)
        .values({ versionId: version!.id, subjectTypeId: type!.id, ...values })
        .returning()
      idsByIndex.push(created!.id)
      createdCount++
      continue
    }
    idsByIndex.push(previous.id)
    const structureChanged =
      previous.parentId !== parentId ||
      previous.level !== n.level ||
      previous.frequency !== n.frequency ||
      previous.storageFolder !== n.storageFolder
    if (immutableStructure && structureChanged) {
      throw new LawIndexError([
        `${n.path}: cambia la estructura de una versión ${version!.status} (crea una versión nueva)`,
      ])
    }
    const changed =
      structureChanged ||
      previous.title !== n.title ||
      previous.description !== n.description ||
      previous.order !== n.order ||
      previous.label !== n.label ||
      !previous.active
    if (changed) {
      await tx.update(lawIndexNodes).set(values).where(eq(lawIndexNodes.id, previous.id))
      updated++
    }
  }

  const leftovers = existing.filter((n) => !seen.has(lookupKeyOf(n)) && n.active).map((n) => n.id)
  if (leftovers.length > 0) {
    if (immutableStructure)
      throw new LawIndexError([
        `Faltan ${leftovers.length} nodos que ya existen en una versión ${version!.status}`,
      ])
    await tx
      .update(lawIndexNodes)
      .set({ active: false })
      .where(and(inArray(lawIndexNodes.id, leftovers), isNull(lawIndexNodes.parentId)))
    await tx
      .update(lawIndexNodes)
      .set({ active: false })
      .where(inArray(lawIndexNodes.id, leftovers))
  }

  return {
    versionId: version!.id,
    subjectTypeId: type!.id,
    created: createdCount,
    updated,
    deactivated: leftovers.length,
  }
}

/** Marca una versión como vigente (y la anterior vigente como histórica). */
export async function publishVersion(tx: Tx, versionId: string): Promise<void> {
  const v = await tx.query.lawIndexVersions.findFirst({ where: eq(lawIndexVersions.id, versionId) })
  if (!v) throw new Error('Versión no encontrada')
  await tx
    .update(lawIndexVersions)
    .set({ status: 'historical' })
    .where(and(eq(lawIndexVersions.stateId, v.stateId), eq(lawIndexVersions.status, 'current')))
  await tx
    .update(lawIndexVersions)
    .set({ status: 'current', publishedAt: new Date() })
    .where(eq(lawIndexVersions.id, versionId))
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
