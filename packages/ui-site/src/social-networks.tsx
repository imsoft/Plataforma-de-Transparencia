import { accessibleLabel, networkBySlug } from '@platform/social-networks'
import { NetworkIcon } from './network-icons'
import type { SiteSocialNetwork } from './types'

export function SocialNetworks({
  networks,
  subjectName,
  className = '',
  dark = false,
}: {
  networks: SiteSocialNetwork[]
  subjectName: string
  className?: string
  dark?: boolean
}) {
  if (networks.length === 0) return null
  const style = dark
    ? 'bg-white/10 text-white hover:bg-white hover:text-neutral-900'
    : 'bg-primario-suave text-primario-legible hover:bg-primario-legible hover:text-sobre-primario'
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Redes sociales">
      {networks.map((r, i) => {
        const network = networkBySlug(r.network)
        const label = accessibleLabel(
          network,
          r.text ?? (r.network === 'otra' ? r.otherName : null),
          subjectName,
        )
        return (
          <li key={`${r.url}-${i}`}>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className={`grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario-legible ${style}`}
            >
              <NetworkIcon slug={network.slug} className="size-5" />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
