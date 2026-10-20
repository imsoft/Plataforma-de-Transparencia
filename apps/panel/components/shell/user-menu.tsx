'use client'
import { Avatar, AvatarFallback } from '@platform/ui/components/avatar'
import { Button } from '@platform/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@platform/ui/components/dropdown-menu'
import { BuildingIcon, LayoutDashboardIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function UserMenu({
  name,
  email,
  role,
  multipleMunicipalities,
  isSuperadmin,
  isSupervisor = false,
}: {
  name: string
  email: string
  role: string
  multipleMunicipalities: boolean
  isSuperadmin: boolean
  isSupervisor?: boolean
}) {
  const router = useRouter()
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" className="gap-2 px-2" aria-label="Menú de usuario" />}
      >
        <Avatar className="size-8">
          <AvatarFallback className="text-foreground">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm sm:inline">{name.split(' ')[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">{role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {multipleMunicipalities && (
          <DropdownMenuItem onClick={() => router.push('/municipios')}>
            <BuildingIcon aria-hidden /> Cambiar de municipio
          </DropdownMenuItem>
        )}
        {(isSuperadmin || isSupervisor) && (
          <DropdownMenuItem onClick={() => router.push('/supervisor')}>
            <LayoutDashboardIcon aria-hidden /> Tablero de municipios
          </DropdownMenuItem>
        )}
        {isSuperadmin && (
          <DropdownMenuItem onClick={() => router.push('/admin')}>
            <ShieldCheckIcon aria-hidden /> Administración de la plataforma
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => router.push('/cuenta')}>
          Mi cuenta y seguridad
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut()
            router.push('/iniciar-sesion')
            router.refresh()
          }}
        >
          <LogOutIcon aria-hidden /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
