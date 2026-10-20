import { describe, expect, it } from 'vitest'
import { detectNetwork, whatsappLink, validateLink } from '.'

describe('redes sociales', () => {
  it('detecta la red por dominio', () => {
    expect(detectNetwork('https://www.facebook.com/AyuntamientoTuxcacuesco')?.slug).toBe('facebook')
    expect(detectNetwork('https://twitter.com/gob')?.slug).toBe('x')
    expect(detectNetwork('https://youtu.be/abc')?.slug).toBe('youtube')
    expect(detectNetwork('https://tuxcacuesco.gob.mx')).toBeNull()
    expect(detectNetwork('no es url')).toBeNull()
  })
  it('genera enlaces de WhatsApp', () => {
    expect(whatsappLink('343 437 0001')).toBe('https://wa.me/523434370001')
    expect(whatsappLink('+52 343 437 0001', 'Hola')).toBe('https://wa.me/523434370001?text=Hola')
    expect(whatsappLink('12345')).toBeNull()
  })
  it('valida con aviso sin bloquear', () => {
    expect(validateLink('http://facebook.com/x', 'facebook')).toMatchObject({ ok: false })
    const withNotice = validateLink('https://facebook.com/x', 'instagram')
    expect(withNotice.ok && withNotice.warning).toMatch(/Instagram/)
    expect(validateLink('https://instagram.com/x', 'instagram')).toMatchObject({
      ok: true,
      warning: null,
    })
    expect(validateLink('https://midominio.gob.mx', 'otra')).toMatchObject({
      ok: true,
      warning: null,
    })
  })
})
