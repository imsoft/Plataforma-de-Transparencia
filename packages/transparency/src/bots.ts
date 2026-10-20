/** Robots de vista previa de redes y mensajería (NO buscadores: tratarlos distinto sería cloaking). */
export const PREVIEW_BOTS = [
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

export function isPreviewBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return PREVIEW_BOTS.some((b) => ua.includes(b))
}
