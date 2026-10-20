'use client'
import { Button } from '@platform/ui/components/button'
import { Checkbox } from '@platform/ui/components/checkbox'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { assignSupervisor } from '@/actions/admin'

type Supervisor = { name: string; email: string; municipalities: { id: string; name: string }[] }

export function AssignSupervisor({
  municipalities,
  supervisors,
}: {
  municipalities: { id: string; name: string }[]
  supervisors: Supervisor[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [email, setEmail] = useState('')
  const [chosenIds, setChosenIds] = useState<string[]>([])
  function edit(s: Supervisor) {
    setEmail(s.email)
    setChosenIds(s.municipalities.map((m) => m.id))
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            const r = await assignSupervisor(email, chosenIds)
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
              checked={chosenIds.length === municipalities.length}
              onCheckedChange={(v) => setChosenIds(v ? municipalities.map((m) => m.id) : [])}
            />{' '}
            Todos
          </label>
          {municipalities.map((m) => (
            <label key={m.id} className="flex items-center gap-2 pl-6 text-sm">
              <Checkbox
                checked={chosenIds.includes(m.id)}
                onCheckedChange={(v) =>
                  setChosenIds((p) => (v ? [...p, m.id] : p.filter((x) => x !== m.id)))
                }
              />{' '}
              {m.name}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending} className="h-11 self-start">
          {pending && <Loader2Icon className="animate-spin" aria-hidden />} Guardar
        </Button>
      </form>
      <ul className="divide-y rounded-xl border bg-card">
        {supervisors.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">Todavía no hay supervisores.</li>
        )}
        {supervisors.map((s) => (
          <li key={s.email} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {s.name} <span className="font-normal text-muted-foreground">· {s.email}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {s.municipalities.map((m) => m.name).join(', ')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => edit(s)}>
              Editar
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
