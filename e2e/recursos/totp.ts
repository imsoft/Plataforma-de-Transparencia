import { createHmac } from 'node:crypto'

/** Secreto TOTP que `pnpm iniciar` siembra a los usuarios con 2FA obligatoria (solo local). */
export const SECRETO_2FA_LOCAL = 'secreto-totp-de-pruebas-locales-32'

/** Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) para un secreto en texto, igual que @better-auth/utils/otp. */
export function codigoTotp(secreto: string, ahora = Date.now()): string {
  const contador = Math.floor(ahora / 1000 / 30)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(contador))
  const h = createHmac('sha1', Buffer.from(secreto, 'utf8')).update(buf).digest()
  const offset = h[h.length - 1]! & 0xf
  const bin =
    ((h[offset]! & 0x7f) << 24) |
    ((h[offset + 1]! & 0xff) << 16) |
    ((h[offset + 2]! & 0xff) << 8) |
    (h[offset + 3]! & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}
