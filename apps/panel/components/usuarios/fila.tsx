'use client'
import { Avatar, AvatarFallback } from '@plataforma/ui/components/avatar'
import { Badge } from '@plataforma/ui/components/badge'
import { Button } from '@plataforma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@plataforma/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@plataforma/ui/components/dropdown-menu'
import { MoreHorizontalIcon, ShieldCheckIcon, ShieldOffIcon, UserMinusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cambiarRol, darDeBaja } from '@/acciones/usuarios'
import { NOMBRE_ROL } from './roles'

type Usuario = {
  memberId: string
  userId: string
  nombre: string
  email: string
  rol: string
  cargo: string | null
  desde: string
  dosPasos: boolean
  sujetosObligadosIds: string[]
}

export function FilaUsuario({
  slug,
  usuario: u,
  sujetos,
  puedeGestionar,
  esSuperadmin,
}: {
  slug: string
  usuario: Usuario
  sujetos: { id: string; nombre: string }[]
  puedeGestionar: boolean
  esSuperadmin: boolean
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [confirmarBaja, setConfirmarBaja] = useState(false)
  const iniciales = u.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  const alcance =
    u.sujetosObligadosIds.length > 0
      ? sujetos
          .filter((s) => u.sujetosObligadosIds.includes(s.id))
          .map((s) => s.nombre)
          .join(', ')
      : null

  function cambiar(rol: 'admin_municipal' | 'capturista' | 'supervisor') {
    iniciar(async () => {
      const r = await cambiarRol(slug, u.memberId, rol)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${u.nombre} ahora es ${NOMBRE_ROL[rol]?.toLowerCase()}`)
      router.refresh()
    })
  }

  return (
    <li className={`flex items-center gap-3 p-3 ${pendiente ? 'opacity-60' : ''}`}>
      <Avatar className="size-10">
        <AvatarFallback className="text-foreground">{iniciales}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {u.nombre} <span className="font-normal text-muted-foreground">· {u.email}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary">{NOMBRE_ROL[u.rol] ?? u.rol}</Badge>
          {u.cargo && <span>{u.cargo}</span>}
          {alcance && <span>· solo {alcance}</span>}
          <span>· desde {u.desde}</span>
          <span className="inline-flex items-center gap-1">
            {u.dosPasos ? (
              <ShieldCheckIcon className="size-3.5 text-green-700" aria-hidden />
            ) : (
              <ShieldOffIcon className="size-3.5 text-amber-600" aria-hidden />
            )}
            {u.dosPasos ? 'Verificación en dos pasos activa' : 'Sin verificación en dos pasos'}
          </span>
        </p>
      </div>
      {puedeGestionar && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label={`Opciones de ${u.nombre}`} />}
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {u.rol !== 'admin_municipal' && (
              <DropdownMenuItem onClick={() => cambiar('admin_municipal')}>
                Hacer administrador del municipio
              </DropdownMenuItem>
            )}
            {u.rol !== 'capturista' && (
              <DropdownMenuItem onClick={() => cambiar('capturista')}>
                Hacer capturista
              </DropdownMenuItem>
            )}
            {esSuperadmin && u.rol !== 'supervisor' && (
              <DropdownMenuItem onClick={() => cambiar('supervisor')}>
                Hacer supervisor
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmarBaja(true)}>
              <UserMinusIcon aria-hidden /> Dar de baja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog open={confirmarBaja} onOpenChange={setConfirmarBaja}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {u.nombre}?</DialogTitle>
            <DialogDescription>
              Perderá el acceso a {NOMBRE_ROL[u.rol]?.toLowerCase()} de este municipio en este
              momento y se cerrarán sus sesiones. Sus documentos y su historial se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarBaja(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await darDeBaja(slug, u.memberId)
                  if (!r.ok) {
                    toast.error(r.error)
                    return
                  }
                  toast.success(`${u.nombre} fue dado de baja`)
                  setConfirmarBaja(false)
                  router.refresh()
                })
              }
            >
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  )
}
