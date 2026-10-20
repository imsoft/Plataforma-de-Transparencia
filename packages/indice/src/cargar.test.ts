import { and, comoSistema, eq } from '@plataforma/db'
import { estados, indiceNodos, indiceVersiones } from '@plataforma/db/schema'
import { cerrar, clienteDePruebas, sufijo } from '@plataforma/db/pruebas'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cargarIndice, publicarVersion } from './cargar'
import type { ArchivoIndice } from './formato'
import pruebaJson from '../datos/prueba/ayuntamiento.json'

const prueba = pruebaJson as ArchivoIndice

const db = clienteDePruebas('migraciones')
const clave = `P${sufijo()}`.slice(0, 5)
const archivo: ArchivoIndice = {
  ...prueba,
  estado: clave,
  version: { ...prueba.version, slug: `prueba-${sufijo()}` },
}

beforeAll(async () => {
  await comoSistema('pruebas', async (tx) => {
    await tx.insert(estados).values({ clave, nombre: 'Estado de prueba' })
  })
})
afterAll(() => cerrar(db))

describe('cargarIndice', () => {
  it('crea la versión y los nodos con sus claves; es idempotente', async () => {
    const r1 = await comoSistema('pruebas', (tx) => cargarIndice(tx, archivo))
    expect(r1.creados).toBeGreaterThan(5)
    const r2 = await comoSistema('pruebas', (tx) => cargarIndice(tx, archivo))
    expect(r2).toMatchObject({ creados: 0, actualizados: 0, desactivados: 0 })
    const nodo = await db.query.indiceNodos.findFirst({
      where: and(eq(indiceNodos.clave, '85b'), eq(indiceNodos.versionId, r1.versionId)),
    })
    expect(nodo?.titulo).toBe('Los estados financieros mensuales')
  })

  it('actualiza títulos y desactiva lo que desaparece en borrador', async () => {
    const modificado = structuredClone(archivo)
    modificado.nodos[0]!.hijos![1]!.hijos![1]!.titulo = 'Estados financieros (nuevo título)'
    modificado.nodos.pop() // quita armonización contable
    const r = await comoSistema('pruebas', (tx) => cargarIndice(tx, modificado))
    expect(r.actualizados).toBe(1)
    expect(r.desactivados).toBe(3)
  })

  it('publicar vuelve la estructura inmutable', async () => {
    const v = await db.query.indiceVersiones.findFirst({
      where: eq(indiceVersiones.slug, archivo.version.slug),
    })
    await comoSistema('pruebas', (tx) => publicarVersion(tx, v!.id))
    const conNodoNuevo = structuredClone(archivo)
    conNodoNuevo.nodos[1]!.hijos!.push({ nivel: 'fraccion', numero: 'XXI', titulo: 'Nueva' })
    await expect(comoSistema('pruebas', (tx) => cargarIndice(tx, conNodoNuevo))).rejects.toThrow(
      /no se pueden agregar nodos/,
    )
  })

  it('rechaza un archivo inválido sin tocar la base', async () => {
    await expect(
      comoSistema('pruebas', (tx) =>
        cargarIndice(tx, { ...archivo, nodos: [{ nivel: 'inciso', numero: 'a', titulo: 'x' }] }),
      ),
    ).rejects.toThrow(/la raíz debe ser un artículo/)
  })
})
