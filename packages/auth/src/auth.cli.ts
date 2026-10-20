// Solo para la CLI de Better Auth (`generate:schema`). Las apps usan crearAuth() de ./servidor.ts.
import { createAuth } from './server'
export const auth = createAuth()
