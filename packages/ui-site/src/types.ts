export type MenuLink = { href: string; label: string }
export type SiteSocialNetwork = {
  network: string
  otherName: string | null
  url: string
  text: string | null
}
export type SiteIdentity = {
  name: string
  officialName: string
  coatOfArmsUrl: string | null
  administrationLogoUrl: string | null
  contact: { address?: string; phone?: string; email?: string; hours?: string }
  platformName: string
  platformUrl: string
}
