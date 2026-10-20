import { pgEnum } from 'drizzle-orm/pg-core'

export const estatusVersionEnum = pgEnum('estatus_version', ['borrador', 'vigente', 'historica'])
export const nivelNodoEnum = pgEnum('nivel_nodo', ['articulo', 'fraccion', 'inciso', 'subinciso'])
export const periodicidadEnum = pgEnum('periodicidad', [
  'mensual',
  'trimestral',
  'semestral',
  'anual',
  'permanente',
])
export const tipoEquivalenciaEnum = pgEnum('tipo_equivalencia', ['exacta', 'parcial'])
export const estatusMunicipioEnum = pgEnum('estatus_municipio', ['activo', 'panel_suspendido'])
export const plantillaEnum = pgEnum('plantilla', [
  'institucional-clasica',
  'moderna-minimalista',
  'ciudadana-servicios',
])
export const estadoDocumentoEnum = pgEnum('estado_documento', [
  'publicado',
  'oculto',
  'historico',
  'papelera',
])
export const tipoDocumentoEnum = pgEnum('tipo_documento', ['archivo', 'video_externo'])
export const tipoArchivoEnum = pgEnum('tipo_archivo', [
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'zip',
  'video',
  'imagen',
])
export const estadoExportacionEnum = pgEnum('estado_exportacion', [
  'pendiente',
  'generando',
  'lista',
  'error',
])
