export { Pagina as default, generateMetadata } from '@plataforma/transparencia/next/pagina'

// Configuración de segmento: debe declararse aquí, Next no acepta re-exports
export const revalidate = 86400
export const dynamicParams = true
