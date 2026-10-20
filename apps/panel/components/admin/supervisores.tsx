'use client'
import { Button } from '@plataforma/ui/components/button'
import { Checkbox } from '@plataforma/ui/components/checkbox'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { asignarSupervisor } from '@/acciones/admin'

type Supervisor = { nombre: string; email: string; municipios: { id: string; nombre: string }[] }

export function AsignarSupervisor({
  municipios,
  supervisores,
}: {
  municipios: { id: string; nombre: string }[]
  supervisores: Supervisor[]
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [email, setEmail] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  function editar(s: Supervisor) {
    setEmail(s.email)
    setElegidos(s.municipios.map((m) => m.id))
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          iniciar(async () => {
            const r = await asignarSupervisor(email, elegidos)
            if (!r.ok) {
              toast.error(r.error)
              return
            }
            toast.success('Municipios del supervisor actualizados')
            router.refresh()
          })
        }}
        className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="sup-email">Correo del supervisor</Label>
          <Input
            id="sup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Municipios asignados</legend>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={elegidos.length === municipios.length}
              onCheckedChange={(v) => setElegidos(v ? municipios.map((m) => m.id) : [])}
            />{' '}
            Todos
          </label>
          {municipios.map((m) => (
            <label key={m.id} className="flex items-center gap-2 pl-6 text-sm">
              <Checkbox
                checked={elegidos.includes(m.id)}
                onCheckedChange={(v) =>
                  setElegidos((p) => (v ? [...p, m.id] : p.filter((x) => x !== m.id)))
                }
              />{' '}
              {m.nombre}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pendiente} className="h-11 self-start">
          {pendiente && <Loader2Icon className="animate-spin" aria-hidden />} Guardar
        </Button>
      </form>
      <ul className="divide-y rounded-xl border bg-card">
        {supervisores.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">Todavía no hay supervisores.</li>
        )}
        {supervisores.map((s) => (
          <li key={s.email} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.nombre} <span className="font-normal text-muted-foreground">· {s.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {s.municipios.map((m) => m.nombre).join(', ')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => editar(s)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
