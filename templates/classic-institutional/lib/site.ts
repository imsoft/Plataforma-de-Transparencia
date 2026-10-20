import 'server-only'
import { siteConfig } from '@platform/transparency/next/config'
import { getMunicipality, type PublicMunicipality } from '@platform/transparency/next/data'
import type { SiteIdentity, SiteSocialNetwork } from '@platform/ui-site/types'

export async function municipalityOrFallback(): Promise<PublicMunicipality> {
  const m = await getMunicipality()
  if (m) return m
  // Fallback si la base no responde: el sitio sigue sirviendo su shell
  return {
    id: '',
    slug: '__SLUG__',
    name: '__NAME__',
    officialName: 'H. Ayuntamiento de __NAME__',
    stateId: '',
    contactInfo: {},
    theme: null,
    subjects: [],
    networks: [],
    version: null,
  }
}

export function identityOf(m: PublicMunicipality): SiteIdentity {
  const { filesPublicUrl, platformName, platformUrl } = siteConfig()
  const url = (r: string | null | undefined) => (r ? `${filesPublicUrl}/${r}` : null)
  return {
    name: m.name,
    officialName: m.officialName,
    coatOfArmsUrl: url(m.theme?.coatOfArmsPath),
    administrationLogoUrl: url(m.theme?.administrationLogoPath),
    contact: m.contactInfo,
    platformName,
    platformUrl,
  }
}

export function cityHallNetworks(m: PublicMunicipality): SiteSocialNetwork[] {
  return m.networks
    .filter((r) => !r.obligatedSubjectId)
    .map((r) => ({ network: r.network, otherName: r.otherName, url: r.url, text: r.text }))
}
