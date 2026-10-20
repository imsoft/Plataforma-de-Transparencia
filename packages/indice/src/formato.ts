/** Formato del archivo JSON del índice (una versión × un tipo de sujeto obligado). Validado con zod. */
import { z } from 'zod'

export const PERIODICIDADES = ['mensual', 'trimestral', 'semestral', 'anual', 'permanente'] as const
export type Periodicidad = (typeof PERIODICIDADES)[number]
export const NIVELES = ['articulo', 'fraccion', 'inciso', 'subinciso'] as const
export type Nivel = (typeof NIVELES)[number]

const nodoBase = z.object({
  nivel: z.enum(NIVELES),
  /** '8', 'V' o '5', 'a', '1'. Vacío solo en secciones sin numeración legal (con rutaSlug). */
  numero: z.string().trim().optional(),
  /** Solo para raíces sin artículo (ej. 'armonizacion-contable'). */
  rutaSlug: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'rutaSlug: minúsculas, números y guiones, empieza con letra')
    .optional(),
  titulo: z.string().trim().min(1),
  descripcion: z.string().trim().optional(),
  periodicidad: z.enum(PERIODICIDADES).optional(),
  /** true cuando la periodicidad se infirió y falta que la confirme el supervisor. */
  periodicidadPorConfirmar: z.boolean().optional(),
})

export type NodoArchivo = z.infer<typeof nodoBase> & { hijos?: NodoArchivo[] | undefined }

export const nodoArchivoSchema: z.ZodType<NodoArchivo> = nodoBase.extend({
  hijos: z.lazy(() => z.array(nodoArchivoSchema)).optional(),
})

export const archivoIndiceSchema = z.object({
  estado: z.string().trim().min(2).max(5), // 'JAL'
  version: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    nombre: z.string().min(1),
    vigenciaDesde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  tipoSujetoObligado: z.string().regex(/^[a-z0-9-]+$/),
  nodos: z.array(nodoArchivoSchema).min(1),
})

export type ArchivoIndice = z.infer<typeof archivoIndiceSchema>
