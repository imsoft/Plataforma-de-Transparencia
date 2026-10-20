import { next } from '@platform/config/eslint/next'

export default [...next, { ignores: ['.next/**', 'next-env.d.ts'] }]
