/**
 * Aplana el árbol del archivo a una lista de nodos con clave, carpeta y etiqueta,
 * validando jerarquía, claves únicas y periodicidad. Función pura, sin base de datos.
 */
import { arabicToRoman, nodeFolder, buildKey, fractionNumber, type KeySegments } from './keys'
import {
  lawIndexFileSchema,
  type LawIndexFile,
  type Level,
  type FileNode,
  type Frequency,
} from './format'

export type FlatNode = {
  /** Índice en la lista; el padre siempre aparece antes. */
  lawIndex: number
  parentIndex: number | null
  level: Level
  number: string
  label: string
  title: string
  description: string | null
  key: string | null
  routeSlug: string | null
  frequency: Frequency
  frequencyToConfirm: boolean
  storageFolder: string
  order: number
  /** Ruta desde la raíz, para mensajes de error. */
  path: string
}

export type ValidationResult =
  { ok: true; nodes: FlatNode[]; file: LawIndexFile } | { ok: false; errors: string[] }

const LEVEL_ORDER: Record<Level, number> = { article: 0, fraction: 1, item: 2, subitem: 3 }
const LEVEL_LABEL: Record<Level, string> = {
  article: 'artículo',
  fraction: 'fracción',
  item: 'inciso',
  subitem: 'subinciso',
}

export function validateLawIndex(input: unknown): ValidationResult {
  const parse = lawIndexFileSchema.safeParse(input)
  if (!parse.success) {
    return {
      ok: false,
      errors: parse.error.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`),
    }
  }
  const file = parse.data
  const errors: string[] = []
  const nodes: FlatNode[] = []
  const seenKeys = new Map<string, string>()
  const seenSlugs = new Map<string, string>()

  const walk = (
    node: FileNode,
    parent: FlatNode | null,
    segments: KeySegments | null,
    order: number,
    parentPath: string,
  ): void => {
    const path = `${parentPath}/${node.routeSlug ?? node.number ?? '?'}`
    if (parent && LEVEL_ORDER[node.level] !== LEVEL_ORDER[parent.level] + 1) {
      errors.push(
        `${path}: un ${LEVEL_LABEL[node.level]} no puede colgar de un ${LEVEL_LABEL[parent.level]}`,
      )
      return
    }
    if (!parent && node.level !== 'article') {
      errors.push(`${path}: la raíz debe ser un artículo (o sección con rutaSlug)`)
      return
    }
    const frequency = node.frequency ?? parent?.frequency
    if (!frequency) {
      errors.push(`${path}: falta periodicidad (en el nodo o en algún ancestro)`)
      return
    }

    const isSection = !parent && node.routeSlug !== undefined
    const underSection = parent !== null && segments === null
    let newSegments: KeySegments | null = null
    let key: string | null = null
    let folder: string
    let label: string
    let number: string

    if (isSection) {
      const slug = node.routeSlug!
      if (node.number) errors.push(`${path}: una sección con rutaSlug no lleva número`)
      if (seenSlugs.has(slug)) errors.push(`${path}: rutaSlug duplicado "${slug}"`)
      seenSlugs.set(slug, path)
      number = ''
      label = node.title
      folder = slug
    } else if (underSection) {
      if (!node.number) {
        errors.push(`${path}: falta número`)
        return
      }
      number = node.number
      label = node.title
      folder = `${parent.storageFolder}/${node.number.toLowerCase().padStart(2, '0')}`
    } else {
      if (!node.number) {
        errors.push(`${path}: falta número`)
        return
      }
      try {
        const base: KeySegments = segments ? { ...segments } : { article: node.number }
        switch (node.level) {
          case 'article':
            newSegments = { article: node.number }
            number = String(Number(node.number))
            label = `Art. ${number}`
            break
          case 'fraction':
            newSegments = { ...base, fraction: node.number }
            number = fractionNumber(node.number)
            label = `Fracc. ${arabicToRoman(Number(number))}`
            break
          case 'item':
            newSegments = { ...base, item: node.number }
            number = node.number.toLowerCase() // 'ñ' se conserva en etiqueta y número; en la clave es 'nn'
            label = `Inciso ${number}`
            break
          case 'subitem':
            newSegments = { ...base, subitem: node.number }
            number = String(Number(node.number))
            label = `Numeral ${number}`
            break
        }
        key = buildKey(newSegments)
        folder = nodeFolder(newSegments)
      } catch (e) {
        errors.push(`${path}: ${(e as Error).message}`)
        return
      }
      const previous = seenKeys.get(key)
      if (previous) {
        errors.push(`${path}: clave duplicada "${key}" (ya la usa ${previous})`)
        return
      }
      seenKeys.set(key, path)
    }

    const flat: FlatNode = {
      lawIndex: nodes.length,
      parentIndex: parent?.lawIndex ?? null,
      level: node.level,
      number,
      label,
      title: node.title,
      description: node.description ?? null,
      key,
      routeSlug: isSection ? node.routeSlug! : null,
      frequency,
      frequencyToConfirm: node.frequencyToConfirm ?? false,
      storageFolder: folder,
      order,
      path,
    }
    nodes.push(flat)
    node.children?.forEach((h, i) =>
      walk(h, flat, isSection || underSection ? null : newSegments, i, path),
    )
  }

  file.nodes.forEach((n, i) => walk(n, null, null, i, ''))
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, nodes, file }
}
