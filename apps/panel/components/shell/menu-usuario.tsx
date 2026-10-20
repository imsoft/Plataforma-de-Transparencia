'use client'
import { Avatar, AvatarFallback } from '@plataforma/ui/components/avatar'
import { Button } from '@plataforma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@plataforma/ui/components/dropdown-menu'
import { BuildingIcon, LayoutDashboardIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authCliente } from '@/lib/auth-cliente'

export function MenuUsuario({
  nombre,
  email,
  rol,
  variosMunicipios,
  esSuperadmin,
  esSupervisor = false,
}: {
  nombre: string
  email: string
  rol: string
  variosMunicipios: boolean
  esSuperadmin: boolean
  esSupervisor?: boolean
}) {
  const router = useRouter()
  const iniciales = nombre
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
          <AvatarFallback className="text-foreground">{iniciales}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm sm:inline">{nombre.split(' ')[0]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate font-medium">{nombre}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          <p className="mt-1 text-xs font-normal text-muted-foreground">{rol}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {variosMunicipios && (
          <DropdownMenuItem onClick={() => router.push('/municipios')}>
            <BuildingIcon aria-hidden /> Cambiar de municipio
          </DropdownMenuItem>
        )}
        {(esSuperadmin || esSupervisor) && (
          <DropdownMenuItem onClick={() => router.push('/supervisor')}>
            <LayoutDashboardIcon aria-hidden /> Tablero de municipios
          </DropdownMenuItem>
        )}
        {esSuperadmin && (
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
            await authCliente.signOut()
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
