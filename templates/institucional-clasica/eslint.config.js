import { next } from '@plataforma/config/eslint/next'

export default [...next, { ignores: ['.next/**', 'next-env.d.ts'] }]
