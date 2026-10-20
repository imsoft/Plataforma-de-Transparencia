import 'server-only'
import { ErrorPermiso } from '@plataforma/auth'
import { ZodError } from 'zod'

export type Resultado<T = undefined> = { ok: true; datos: T } | { ok: false; error: string }

/** Envuelve una acción: errores de permiso y validación se vuelven mensajes claros; el resto va a Sentry/consola. */
export async function accion<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, datos: await fn() }
  } catch (e) {
    if (e instanceof ErrorPermiso) return { ok: false, error: e.message }
    if (e instanceof ZodError)
      return { ok: false, error: e.issues[0]?.message ?? 'Revisa los datos.' }
    if (e instanceof ErrorUsuario) return { ok: false, error: e.message }
    console.error(e)
    return { ok: false, error: 'Algo salió mal. Intenta de nuevo; si sigue fallando, avísanos.' }
  }
}

/** Error con mensaje pensado para la persona (no técnico). */
export class ErrorUsuario extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorUsuario'
  }
}
