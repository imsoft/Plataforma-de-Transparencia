import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { base } from './base.js'

/** Paquetes de componentes React (sin Next). */
export const react = tseslint.config(...base, reactHooks.configs.flat.recommended, {
  languageOptions: { globals: { ...globals.browser, ...globals.node } },
})

export default react
