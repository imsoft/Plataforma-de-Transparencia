import { describe, expect, it } from 'vitest'
import { esBotDeVistaPrevia } from './bots'

describe('esBotDeVistaPrevia', () => {
  it('reconoce WhatsApp y Facebook, no a Google ni a Chrome', () => {
    expect(esBotDeVistaPrevia('WhatsApp/2.23.20.0 A')).toBe(true)
    expect(
      esBotDeVistaPrevia(
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      ),
    ).toBe(true)
    expect(
      esBotDeVistaPrevia(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      ),
    ).toBe(false)
    expect(
      esBotDeVistaPrevia('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'),
    ).toBe(false)
    expect(esBotDeVistaPrevia(null)).toBe(false)
  })
})
