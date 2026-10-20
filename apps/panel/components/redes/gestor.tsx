'use client'
import { detectarRed, REDES, redPorSlug, validarEnlace } from '@plataforma/redes'
import { Button } from '@plataforma/ui/components/button'
import { Checkbox } from '@plataforma/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@plataforma/ui/components/dialog'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { IconoRed } from '@plataforma/ui-sitio/iconos-redes'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { eliminarRed, guardarRed, reordenarRedes } from '@/acciones/redes'

type Red = {
  id: string
  sujetoObligadoId: string | null
  red: string
  nombreOtra: string | null
  url: string
  texto: string | null
  visible: boolean
  ocultarEnVeda: boolean
}
type Sujeto = { id: string; nombre: string; raiz: boolean }
const vacia = (): Omit<Red, 'id'> & { id?: string } => ({
  sujetoObligadoId: null,
  red: 'facebook',
  nombreOtra: null,
  url: '',
  texto: null,
  visible: true,
  ocultarEnVeda: false,
})

export function GestorRedes({
  slug,
  redes,
  sujetos,
  puedeEditar,
  nombreOficial,
}: {
  slug: string
  redes: Red[]
  sujetos: Sujeto[]
  puedeEditar: boolean
  nombreOficial: string
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [editando, setEditando] = useState<(Omit<Red, 'id'> & { id?: string }) | null>(null)

  function mover(i: number, dir: -1 | 1) {
    const ids = redes.map((r) => r.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    iniciar(async () => {
      const r = await reordenarRedes(slug, ids)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {puedeEditar && (
        <Button className="h-11 self-start" onClick={() => setEditando(vacia())}>
          <PlusIcon aria-hidden /> Agregar red social
        </Button>
      )}
      {redes.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no hay redes sociales. Agrega la primera: solo pega el enlace.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {redes.map((r, i) => {
            const def = redPorSlug(r.red)
            const sujeto = r.sujetoObligadoId
              ? sujetos.find((s) => s.id === r.sujetoObligadoId)?.nombre
              : 'Todo el municipio'
            return (
              <li
                key={r.id}
                className={`flex items-center gap-3 p-3 ${pendiente ? 'opacity-60' : ''} ${r.visible ? '' : 'opacity-50'}`}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <IconoRed slug={def.slug} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.texto || (r.red === 'otra' ? r.nombreOtra : def.nombre)}{' '}
                    {!r.visible && (
                      <span className="text-xs font-normal text-muted-foreground">(oculta)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {sujeto} · {r.url}
                  </p>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden rounded-md p-2 text-muted-foreground hover:bg-accent sm:block"
                  aria-label={`Probar enlace de ${def.nombre}`}
                >
                  <ExternalLinkIcon className="size-4" aria-hidden />
                </a>
                {puedeEditar && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                    >
                      <ArrowUpIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Bajar"
                      disabled={i === redes.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      <ArrowDownIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setEditando(r)}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      onClick={() =>
                        iniciar(async () => {
                          const x = await eliminarRed(slug, r.id)
                          if (!x.ok) {
                            toast.error(x.error)
                            return
                          }
                          toast('Red social eliminada')
                          router.refresh()
                        })
                      }
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="mb-2 text-sm font-medium">Vista previa en el sitio</p>
        <ul className="flex flex-wrap gap-2">
          {redes
            .filter((r) => r.visible)
            .map((r) => (
              <li
                key={r.id}
                className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
                title={`${redPorSlug(r.red).nombre} de ${nombreOficial}`}
              >
                <IconoRed slug={r.red} className="size-5" />
              </li>
            ))}
        </ul>
      </div>
      {editando && (
        <DialogoRed slug={slug} red={editando} sujetos={sujetos} cerrar={() => setEditando(null)} />
      )}
    </div>
  )
}

function DialogoRed({
  slug,
  red: inicial,
  sujetos,
  cerrar,
}: {
  slug: string
  red: Omit<Red, 'id'> & { id?: string }
  sujetos: Sujeto[]
  cerrar: () => void
}) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [red, setRed] = useState(inicial.red)
  const [url, setUrl] = useState(inicial.url)
  const [numero, setNumero] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [texto, setTexto] = useState(inicial.texto ?? '')
  const [nombreOtra, setNombreOtra] = useState(inicial.nombreOtra ?? '')
  const [sujetoId, setSujetoId] = useState<string | null>(inicial.sujetoObligadoId)
  const [visible, setVisible] = useState(inicial.visible)
  const [veda, setVeda] = useState(inicial.ocultarEnVeda)
  const detectada = url ? detectarRed(url) : null
  const validacion = url && red !== 'whatsapp' ? validarEnlace(url, red) : null

  function pegar(valor: string) {
    setUrl(valor)
    const d = detectarRed(valor)
    if (d && red !== 'otra') setRed(d.slug)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            iniciar(async () => {
              const r = await guardarRed(slug, {
                id: inicial.id,
                sujetoObligadoId: sujetoId,
                red,
                nombreOtra: red === 'otra' ? nombreOtra || null : null,
                url: red === 'whatsapp' && !url ? 'https://wa.me/0' : url,
                whatsapp: red === 'whatsapp' && numero ? { numero, mensaje } : undefined,
                texto: texto || null,
                visible,
                ocultarEnVeda: veda,
              })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success(inicial.id ? 'Red social actualizada' : 'Red social agregada')
              if (r.datos.aviso) toast.warning(r.datos.aviso)
              cerrar()
              router.refresh()
            })
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{inicial.id ? 'Editar red social' : 'Agregar red social'}</DialogTitle>
            <DialogDescription>
              Pega el enlace y reconocemos la red. Si tienen varias cuentas de la misma red, ponles
              un texto distinto.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="red">Red</Label>
            <select
              id="red"
              value={red}
              onChange={(e) => setRed(e.target.value)}
              className="h-11 rounded-md border bg-background px-3"
            >
              {REDES.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>
          {red === 'otra' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="nombreOtra">Nombre de la red</Label>
              <Input
                id="nombreOtra"
                value={nombreOtra}
                onChange={(e) => setNombreOtra(e.target.value)}
                required
                className="h-11"
              />
            </div>
          )}
          {red === 'whatsapp' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="numero">Número de WhatsApp (10 dígitos)</Label>
                <Input
                  id="numero"
                  inputMode="tel"
                  placeholder="343 437 0001"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  required={!inicial.id}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="mensaje">Mensaje inicial (opcional)</Label>
                <Input
                  id="mensaje"
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Hola, quiero información sobre…"
                  className="h-11"
                />
              </div>
              {inicial.url && (
                <p className="text-xs text-muted-foreground">Enlace actual: {inicial.url}</p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-1">
              <Label htmlFor="url">Enlace</Label>
              <Input
                id="url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => pegar(e.target.value)}
                placeholder="https://www.facebook.com/…"
                required
                className="h-11"
              />
              {detectada && detectada.slug !== red && red !== 'otra' && (
                <p className="text-xs text-amber-700">
                  Este enlace parece de {detectada.nombre}, ¿es correcto?
                </p>
              )}
              {validacion && !validacion.ok && (
                <p className="text-xs text-destructive">{validacion.error}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="texto">Texto (opcional)</Label>
            <Input
              id="texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ej. Facebook del DIF"
              maxLength={80}
              className="h-11"
            />
          </div>
          {sujetos.length > 1 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="sujeto">¿De quién es la cuenta?</Label>
              <select
                id="sujeto"
                value={sujetoId ?? ''}
                onChange={(e) => setSujetoId(e.target.value || null)}
                className="h-11 rounded-md border bg-background px-3"
              >
                <option value="">Todo el municipio (Ayuntamiento)</option>
                {sujetos
                  .filter((s) => !s.raiz)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={visible} onCheckedChange={(v) => setVisible(Boolean(v))} /> Mostrar
            en el sitio
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={veda} onCheckedChange={(v) => setVeda(Boolean(v))} /> Ocultar durante
            la veda electoral
          </label>
          <DialogFooter>
            {url && (
              <Button
                type="button"
                variant="ghost"
                nativeButton={false}
                render={<a href={url} target="_blank" rel="noopener noreferrer" />}
              >
                Probar enlace
              </Button>
            )}
            <Button type="button" variant="outline" onClick={cerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendiente} className="h-11">
              {pendiente && <Loader2Icon className="animate-spin" aria-hidden />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
