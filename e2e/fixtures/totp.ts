import { createHmac } from 'node:crypto'

/** Secreto TOTP que `pnpm bootstrap` siembra a los usuarios con 2FA obligatoria (solo local). */
export const LOCAL_2FA_SECRET = 'secreto-totp-de-pruebas-locales-32'

/** Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) para un secreto en texto, igual que @better-auth/utils/otp. */
export function totpCode(secret: string, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', Buffer.from(secret, 'utf8')).update(buf).digest()
  const offset = h[h.length - 1]! & 0xf
  const bin =
    ((h[offset]! & 0x7f) << 24) |
    ((h[offset + 1]! & 0xff) << 16) |
    ((h[offset + 2]! & 0xff) << 8) |
    (h[offset + 3]! & 0xff)
  return String(bin % 1_000_000).padStart(6, '0')
}
