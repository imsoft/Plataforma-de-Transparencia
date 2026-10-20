import { urlPublica } from '@plataforma/archivos'
import Link from 'next/link'
import type { ContextoMunicipio } from '@/lib/municipio'
import { env } from '@/lib/env'
import { CambiarTema } from './cambiar-tema'
import { MenuUsuario } from './menu-usuario'

const NOMBRE_ROL: Record<string, string> = {
  superadmin: 'Superadministrador',
  admin_municipal: 'Administrador del municipio',
  capturista: 'Capturista',
  supervisor: 'Supervisor',
}

export function Encabezado({ c }: { c: ContextoMunicipio }) {
  const { municipio: m, sesion } = c
  const escudo = m.tema?.escudoRuta ? urlPublica(m.tema.escudoRuta) : null
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link
          href={`/m/${m.slug}`}
          className="flex min-w-0 items-center gap-2.5"
          aria-label={`Inicio de ${m.nombreOficial}`}
        >
          {escudo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={escudo} alt="" className="size-9 rounded-md object-contain" />
          ) : (
            <span
              className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground"
              aria-hidden
            >
              {m.nombre.slice(0, 1)}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-tight">{m.nombre}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">
              {env.NEXT_PUBLIC_PLATFORM_NAME}
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <CambiarTema />
          <MenuUsuario
            nombre={sesion.nombre}
            email={sesion.email}
            rol={NOMBRE_ROL[c.rol] ?? c.rol}
            variosMunicipios={sesion.municipios.length > 1 || sesion.esSuperadmin}
            esSuperadmin={sesion.esSuperadmin}
          />
        </div>
      </div>
    </header>
  )
}
