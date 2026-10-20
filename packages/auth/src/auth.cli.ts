// Solo para la CLI de Better Auth (`generate:schema`). Las apps usan crearAuth() de ./servidor.ts.
import { crearAuth } from './servidor'
export const auth = crearAuth()
