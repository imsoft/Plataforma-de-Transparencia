import { pgEnum } from 'drizzle-orm/pg-core'

export const versionStatusEnum = pgEnum('version_status', ['draft', 'current', 'historical'])
export const nodeLevelEnum = pgEnum('node_level', ['article', 'fraction', 'item', 'subitem'])
export const frequencyEnum = pgEnum('frequency', [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'permanent',
])
export const equivalenceTypeEnum = pgEnum('equivalence_type', ['exact', 'partial'])
export const municipalityStatusEnum = pgEnum('municipality_status', ['active', 'panel_suspended'])
export const templateEnum = pgEnum('template', [
  'classic-institutional',
  'modern-minimalist',
  'citizen-services',
])
export const documentStatusEnum = pgEnum('document_status', [
  'published',
  'hidden',
  'historical',
  'trash',
])
export const documentTypeEnum = pgEnum('document_type', ['file', 'external_video'])
export const fileTypeEnum = pgEnum('file_type', [
  'pdf',
  'word',
  'excel',
  'powerpoint',
  'zip',
  'video',
  'image',
])
export const exportStatusEnum = pgEnum('export_status', ['pending', 'generating', 'ready', 'error'])
