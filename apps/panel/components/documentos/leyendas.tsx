'use client'
import type { PeriodicidadConPeriodo } from '@plataforma/indice'
import { Button } from '@plataforma/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@plataforma/ui/components/dialog'
import { Label } from '@plataforma/ui/components/label'
import { Textarea } from '@plataforma/ui/components/textarea'
import { InfoIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { desmarcarLeyenda, marcarLeyenda } from '@/acciones/documentos'
import { periodoElegido, SelectorPeriodo } from './selector-periodo'

export function Leyendas({
  slug,
  sujetoObligadoId,
  nodoId,
  periodicidad,
  leyendas,
  puedeMarcar,
}: {
  slug: string
  sujetoObligadoId: string
  nodoId: string
  periodicidad: PeriodicidadConPeriodo
  leyendas: { id: string; etiqueta: string; texto: string }[]
  puedeMarcar: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [parte, setParte] = useState(
    periodicidad === 'mensual'
      ? Math.max(1, hoy.getMonth())
      : periodicidad === 'trimestral'
        ? Math.max(1, Math.ceil(hoy.getMonth() / 3))
        : 1,
  )
  const [texto, setTexto] = useState('')

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <InfoIcon className="size-4 text-muted-foreground" aria-hidden /> Periodos sin información
        </h2>
        {puedeMarcar && (
          <Dialog open={abierto} onOpenChange={setAbierto}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              Marcar "No se generó información"
            </DialogTrigger>
            <DialogContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const p = periodoElegido(periodicidad, anio, parte)
                  iniciar(async () => {
                    const r = await marcarLeyenda(slug, {
                      sujetoObligadoId,
                      nodoId,
                      periodoInicio: p.inicio!,
                      periodicidad,
                      texto,
                    })
                    if (!r.ok) {
                      toast.error(r.error)
                      return
                    }
                    toast.success(
                      `Se marcó ${p.etiqueta} como periodo sin información. Cuenta como cumplido.`,
                    )
                    setAbierto(false)
                    setTexto('')
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
                <SelectorPeriodo
                  periodicidad={periodicidad}
                  anio={anio}
                  parte={parte}
                  onChange={(a, p) => (setAnio(a), setParte(p))}
                />
                <div className="flex flex-col gap-1">
                  <Label htmlFor="leyenda-texto">Justificación</Label>
                  <Textarea
                    id="leyenda-texto"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    required
                    minLength={10}
                    maxLength={1000}
                    rows={4}
                    placeholder="Ej. Durante este periodo no se celebraron sesiones de cabildo, por lo que no se generó información."
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAbierto(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={pendiente}>
                    Marcar periodo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      {leyendas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún periodo marcado.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {leyendas.map((l) => (
            <li
              key={l.id}
              className="flex items-start justify-between gap-3 rounded-lg bg-background p-3 text-sm"
            >
              <div>
                <p className="font-medium">{l.etiqueta}</p>
                <p className="text-muted-foreground">{l.texto}</p>
              </div>
              {puedeMarcar && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar leyenda de ${l.etiqueta}`}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await desmarcarLeyenda(slug, l.id)
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
