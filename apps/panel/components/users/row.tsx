'use client'
import { Avatar, AvatarFallback } from '@platform/ui/components/avatar'
import { Badge } from '@platform/ui/components/badge'
import { Button } from '@platform/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@platform/ui/components/dropdown-menu'
import { MoreHorizontalIcon, ShieldCheckIcon, ShieldOffIcon, UserMinusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changeRole, removeMember } from '@/actions/users'
import { ROLE_NAME } from './roles'

type User = {
  memberId: string
  userId: string
  name: string
  email: string
  role: string
  jobTitle: string | null
  from: string
  twoFactor: boolean
  obligatedSubjectIds: string[]
}

export function UserRow({
  slug,
  user: u,
  subjects,
  canManage,
  isSuperadmin,
}: {
  slug: string
  user: User
  subjects: { id: string; name: string }[]
  canManage: boolean
  isSuperadmin: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const initials = u.name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  const scope =
    u.obligatedSubjectIds.length > 0
      ? subjects
          .filter((s) => u.obligatedSubjectIds.includes(s.id))
          .map((s) => s.name)
          .join(', ')
      : null

  function change(role: 'municipal_admin' | 'uploader' | 'supervisor') {
    start(async () => {
      const r = await changeRole(slug, u.memberId, role)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(`${u.name} ahora es ${ROLE_NAME[role]?.toLowerCase()}`)
      router.refresh()
    })
  }

  return (
    <li className={`flex items-center gap-3 p-3 ${pending ? 'opacity-60' : ''}`}>
      <Avatar className="size-10">
        <AvatarFallback className="text-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {u.name} <span className="font-normal text-muted-foreground">· {u.email}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Badge variant="secondary">{ROLE_NAME[u.role] ?? u.role}</Badge>
          {u.jobTitle && <span>{u.jobTitle}</span>}
          {scope && <span>· solo {scope}</span>}
          <span>· desde {u.from}</span>
          <span className="inline-flex items-center gap-1">
            {u.twoFactor ? (
              <ShieldCheckIcon className="size-3.5 text-green-700" aria-hidden />
            ) : (
              <ShieldOffIcon className="size-3.5 text-amber-600" aria-hidden />
            )}
            {u.twoFactor ? 'Verificación en dos pasos activa' : 'Sin verificación en dos pasos'}
          </span>
        </p>
      </div>
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label={`Opciones de ${u.name}`} />}
          >
            <MoreHorizontalIcon aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {u.role !== 'municipal_admin' && (
              <DropdownMenuItem onClick={() => change('municipal_admin')}>
                Hacer administrador del municipio
              </DropdownMenuItem>
            )}
            {u.role !== 'uploader' && (
              <DropdownMenuItem onClick={() => change('uploader')}>
                Hacer capturista
              </DropdownMenuItem>
            )}
            {isSuperadmin && u.role !== 'supervisor' && (
              <DropdownMenuItem onClick={() => change('supervisor')}>
                Hacer supervisor
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setConfirmRemoval(true)}>
              <UserMinusIcon aria-hidden /> Dar de baja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog open={confirmRemoval} onOpenChange={setConfirmRemoval}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Dar de baja a {u.name}?</DialogTitle>
            <DialogDescription>
              Perderá el acceso a {ROLE_NAME[u.role]?.toLowerCase()} de este municipio en este
              momento y se cerrarán sus sesiones. Sus documentos y su historial se conservan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemoval(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await removeMember(slug, u.memberId)
                  if (!r.ok) {
                    toast.error(r.error)
                    return
                  }
                  toast.success(`${u.name} fue dado de baja`)
                  setConfirmRemoval(false)
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
