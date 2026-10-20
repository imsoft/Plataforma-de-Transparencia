export { Page as default, generateMetadata } from '@platform/transparency/next/page'

// Configuración de segmento: debe declararse aquí, Next no acepta re-exports
export const revalidate = 86400
export const dynamicParams = true
