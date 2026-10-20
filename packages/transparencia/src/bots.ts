/** Robots de vista previa de redes y mensajería (NO buscadores: tratarlos distinto sería cloaking). */
export const BOTS_VISTA_PREVIA = [
  'whatsapp',
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'telegrambot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'pinterestbot',
  'skypeuripreview',
  'redditbot',
  'embedly',
  'iframely',
] as const

export function esBotDeVistaPrevia(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOTS_VISTA_PREVIA.some((b) => ua.includes(b))
}
