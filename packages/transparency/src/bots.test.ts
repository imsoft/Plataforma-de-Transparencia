import { describe, expect, it } from 'vitest'
import { isPreviewBot } from './bots'

describe('esBotDeVistaPrevia', () => {
  it('reconoce WhatsApp y Facebook, no a Google ni a Chrome', () => {
    expect(isPreviewBot('WhatsApp/2.23.20.0 A')).toBe(true)
    expect(
      isPreviewBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'),
    ).toBe(true)
    expect(
      isPreviewBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe(false)
    expect(
      isPreviewBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1'),
    ).toBe(false)
    expect(isPreviewBot(null)).toBe(false)
  })
})
