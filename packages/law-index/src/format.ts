/** Formato del archivo JSON del índice (una versión × un tipo de sujeto obligado). Validado con zod. */
import { z } from 'zod'

export const FREQUENCIES = ['monthly', 'quarterly', 'semiannual', 'annual', 'permanent'] as const
export type Frequency = (typeof FREQUENCIES)[number]
export const LEVELS = ['article', 'fraction', 'item', 'subitem'] as const
export type Level = (typeof LEVELS)[number]

const baseNode = z.object({
  level: z.enum(LEVELS),
  /** '8', 'V' o '5', 'a', '1'. Vacío solo en secciones sin numeración legal (con rutaSlug). */
  number: z.string().trim().optional(),
  /** Solo para raíces sin artículo (ej. 'armonizacion-contable'). */
  routeSlug: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, 'rutaSlug: minúsculas, números y guiones, empieza con letra')
    .optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  frequency: z.enum(FREQUENCIES).optional(),
  /** true cuando la periodicidad se infirió y falta que la confirme el supervisor. */
  frequencyToConfirm: z.boolean().optional(),
})

export type FileNode = z.infer<typeof baseNode> & { children?: FileNode[] | undefined }

export const fileNodeSchema: z.ZodType<FileNode> = baseNode.extend({
  children: z.lazy(() => z.array(fileNodeSchema)).optional(),
})

export const lawIndexFileSchema = z.object({
  state: z.string().trim().min(2).max(5), // 'JAL'
  version: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    validFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  }),
  obligatedSubjectType: z.string().regex(/^[a-z0-9-]+$/),
  nodes: z.array(fileNodeSchema).min(1),
})

export type LawIndexFile = z.infer<typeof lawIndexFileSchema>
