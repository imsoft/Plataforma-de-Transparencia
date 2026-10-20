import 'server-only'
import { PermissionError } from '@platform/auth'
import { ZodError } from 'zod'

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

/** Envuelve una acción: errores de permiso y validación se vuelven mensajes claros; el resto va a Sentry/consola. */
export async function action<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    if (e instanceof PermissionError) return { ok: false, error: e.message }
    if (e instanceof ZodError)
      return { ok: false, error: e.issues[0]?.message ?? 'Revisa los datos.' }
    if (e instanceof UserFacingError) return { ok: false, error: e.message }
    console.error(e)
    return { ok: false, error: 'Algo salió mal. Intenta de nuevo; si sigue fallando, avísanos.' }
  }
}

/** Error con mensaje pensado para la persona (no técnico). */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErrorUsuario'
  }
}
