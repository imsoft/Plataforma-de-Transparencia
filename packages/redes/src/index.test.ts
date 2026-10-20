import { describe, expect, it } from 'vitest'
import { detectarRed, enlaceWhatsApp, validarEnlace } from './index'

describe('redes sociales', () => {
  it('detecta la red por dominio', () => {
    expect(detectarRed('https://www.facebook.com/AyuntamientoTuxcacuesco')?.slug).toBe('facebook')
    expect(detectarRed('https://twitter.com/gob')?.slug).toBe('x')
    expect(detectarRed('https://youtu.be/abc')?.slug).toBe('youtube')
    expect(detectarRed('https://tuxcacuesco.gob.mx')).toBeNull()
    expect(detectarRed('no es url')).toBeNull()
  })
  it('genera enlaces de WhatsApp', () => {
    expect(enlaceWhatsApp('343 437 0001')).toBe('https://wa.me/523434370001')
    expect(enlaceWhatsApp('+52 343 437 0001', 'Hola')).toBe('https://wa.me/523434370001?text=Hola')
    expect(enlaceWhatsApp('12345')).toBeNull()
  })
  it('valida con aviso sin bloquear', () => {
    expect(validarEnlace('http://facebook.com/x', 'facebook')).toMatchObject({ ok: false })
    const conAviso = validarEnlace('https://facebook.com/x', 'instagram')
    expect(conAviso.ok && conAviso.aviso).toMatch(/Instagram/)
    expect(validarEnlace('https://instagram.com/x', 'instagram')).toMatchObject({
      ok: true,
      aviso: null,
    })
    expect(validarEnlace('https://midominio.gob.mx', 'otra')).toMatchObject({
      ok: true,
      aviso: null,
    })
  })
})
