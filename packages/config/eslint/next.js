import nextPlugin from '@next/eslint-plugin-next'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { base } from './base.js'

/** Configuración para apps Next.js (panel y sitios). */
export const next = tseslint.config(
  ...base,
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // las apps nunca tocan la base de datos directamente
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@plataforma/db/cliente',
              message: 'Usa conUsuario() o comoPublico(), nunca el cliente crudo.',
            },
          ],
        },
      ],
    },
  },
)

export default next
