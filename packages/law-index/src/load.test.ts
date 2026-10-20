import { and, asSystem, eq } from '@platform/db'
import { states, lawIndexNodes, lawIndexVersions } from '@platform/db/schema'
import { close, testClient, suffix } from '@platform/db/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadLawIndex, publishVersion } from './load'
import type { LawIndexFile } from './format'
import pruebaJson from '../data/sample/city-hall.json'

const sample = pruebaJson as LawIndexFile

const db = testClient('migrator')
const key = `P${suffix()}`.slice(0, 5)
const file: LawIndexFile = {
  ...sample,
  state: key,
  version: { ...sample.version, slug: `prueba-${suffix()}` },
}

beforeAll(async () => {
  await asSystem('tests', async (tx) => {
    await tx.insert(states).values({ key, name: 'Estado de prueba' })
  })
})
afterAll(() => close(db))

describe('cargarIndice', () => {
  it('crea la versión y los nodos con sus claves; es idempotente', async () => {
    const r1 = await asSystem('tests', (tx) => loadLawIndex(tx, file))
    expect(r1.created).toBeGreaterThan(5)
    const r2 = await asSystem('tests', (tx) => loadLawIndex(tx, file))
    expect(r2).toMatchObject({ created: 0, updated: 0, deactivated: 0 })
    const node = await db.query.lawIndexNodes.findFirst({
      where: and(eq(lawIndexNodes.key, '85b'), eq(lawIndexNodes.versionId, r1.versionId)),
    })
    expect(node?.title).toBe('Los estados financieros mensuales')
  })

  it('actualiza títulos y desactiva lo que desaparece en borrador', async () => {
    const modified = structuredClone(file)
    modified.nodes[0]!.children![1]!.children![1]!.title = 'Estados financieros (nuevo título)'
    modified.nodes.pop() // quita armonización contable
    const r = await asSystem('tests', (tx) => loadLawIndex(tx, modified))
    expect(r.updated).toBe(1)
    expect(r.deactivated).toBe(3)
  })

  it('publicar vuelve la estructura inmutable', async () => {
    const v = await db.query.lawIndexVersions.findFirst({
      where: eq(lawIndexVersions.slug, file.version.slug),
    })
    await asSystem('tests', (tx) => publishVersion(tx, v!.id))
    const withNewNode = structuredClone(file)
    withNewNode.nodes[1]!.children!.push({ level: 'fraction', number: 'XXI', title: 'Nueva' })
    await expect(asSystem('tests', (tx) => loadLawIndex(tx, withNewNode))).rejects.toThrow(
      /no se pueden agregar nodos/,
    )
  })

  it('rechaza un archivo inválido sin tocar la base', async () => {
    await expect(
      asSystem('tests', (tx) =>
        loadLawIndex(tx, { ...file, nodes: [{ level: 'item', number: 'a', title: 'x' }] }),
      ),
    ).rejects.toThrow(/la raíz debe ser un artículo/)
  })
})
