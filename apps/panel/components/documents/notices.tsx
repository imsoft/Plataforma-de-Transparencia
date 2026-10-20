'use client'
import type { PeriodicFrequency } from '@platform/law-index'
import { Button } from '@platform/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@platform/ui/components/dialog'
import { Label } from '@platform/ui/components/label'
import { Textarea } from '@platform/ui/components/textarea'
import { InfoIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { unmarkNotice, markNotice } from '@/actions/documents'
import { chosenPeriod, PeriodSelector } from './period-selector'

export function Notices({
  slug,
  obligatedSubjectId,
  nodeId,
  frequency,
  notices,
  canMark,
}: {
  slug: string
  obligatedSubjectId: string
  nodeId: string
  frequency: PeriodicFrequency
  notices: { id: string; label: string; text: string }[]
  canMark: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [part, setPart] = useState(
    frequency === 'monthly'
      ? Math.max(1, today.getMonth())
      : frequency === 'quarterly'
        ? Math.max(1, Math.ceil(today.getMonth() / 3))
        : 1,
  )
  const [text, setText] = useState('')

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <InfoIcon className="size-4 text-muted-foreground" aria-hidden /> Periodos sin información
        </h2>
        {canMark && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Marcar "No se generó información"
            </DialogTrigger>
            <DialogContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const p = chosenPeriod(frequency, year, part)
                  start(async () => {
                    const r = await markNotice(slug, {
                      obligatedSubjectId,
                      nodeId,
                      periodStart: p.start!,
                      frequency,
                      text,
                    })
                    if (!r.ok) {
                      toast.error(r.error)
                      return
                    }
                    toast.success(
                      `Se marcó ${p.label} como periodo sin información. Cuenta como cumplido.`,
                    )
                    setOpen(false)
                    setText('')
                    router.refresh()
                  })
                }}
                className="flex flex-col gap-4"
              >
                <DialogHeader>
                  <DialogTitle>No se generó información</DialogTitle>
                  <DialogDescription>
                    Cuando en un periodo no hubo nada que publicar, la ley pide dejar una
                    justificación. Esto cuenta como cumplido.
                  </DialogDescription>
                </DialogHeader>
                <PeriodSelector
                  frequency={frequency}
                  year={year}
                  part={part}
                  onChange={(a, p) => (setYear(a), setPart(p))}
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor="leyenda-texto">Justificación</Label>
                  <Textarea
                    id="leyenda-texto"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                    placeholder="Ej. Durante este periodo no se celebraron sesiones de cabildo, por lo que no se generó información."
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pending}>
                    Marcar periodo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {notices.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún periodo marcado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notices.map((l) => (
            <li
              key={l.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-background p-3 text-sm"
            >
              <div>
                <p className="font-medium">{l.label}</p>
                <p className="text-muted-foreground">{l.text}</p>
              </div>
              {canMark && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar leyenda de ${l.label}`}
                  onClick={() =>
                    start(async () => {
                      const r = await unmarkNotice(slug, l.id)
                      if (!r.ok) {
                        toast.error(r.error)
                        return
                      }
                      toast('Leyenda retirada')
                      router.refresh()
                    })
                  }
                >
                  <XIcon aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
