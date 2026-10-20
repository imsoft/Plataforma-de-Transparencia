'use client'
import { detectNetwork, NETWORKS, networkBySlug, validateLink } from '@platform/social-networks'
import { Button } from '@platform/ui/components/button'
import { Checkbox } from '@platform/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@platform/ui/components/dialog'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { NetworkIcon } from '@platform/ui-site/network-icons'
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
import { deleteNetwork, saveNetwork, reorderNetworks } from '@/actions/networks'

type Network = {
  id: string
  obligatedSubjectId: string | null
  network: string
  otherName: string | null
  url: string
  text: string | null
  visible: boolean
  hideDuringBlackout: boolean
}
type Subject = { id: string; name: string; root: boolean }
const empty = (): Omit<Network, 'id'> & { id?: string } => ({
  obligatedSubjectId: null,
  network: 'facebook',
  otherName: null,
  url: '',
  text: null,
  visible: true,
  hideDuringBlackout: false,
})

export function NetworksManager({
  slug,
  networks,
  subjects,
  canEdit,
  officialName,
}: {
  slug: string
  networks: Network[]
  subjects: Subject[]
  canEdit: boolean
  officialName: string
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<(Omit<Network, 'id'> & { id?: string }) | null>(null)

  function move(i: number, dir: -1 | 1) {
    const ids = networks.map((r) => r.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    start(async () => {
      const r = await reorderNetworks(slug, ids)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <Button className="h-11 self-start" onClick={() => setEditing(empty())}>
          <PlusIcon aria-hidden /> Agregar red social
        </Button>
      )}
      {networks.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          Todavía no hay redes sociales. Agrega la primera: solo pega el enlace.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {networks.map((r, i) => {
            const def = networkBySlug(r.network)
            const subject = r.obligatedSubjectId
              ? subjects.find((s) => s.id === r.obligatedSubjectId)?.name
              : 'Todo el municipio'
            return (
              <li
                key={r.id}
                className={`flex items-center gap-3 p-3 ${pending ? 'opacity-60' : ''} ${r.visible ? '' : 'opacity-50'}`}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <NetworkIcon slug={def.slug} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.text || (r.network === 'otra' ? r.otherName : def.name)}{' '}
                    {!r.visible && (
                      <span className="text-xs font-normal text-muted-foreground">(oculta)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject} · {r.url}
                  </p>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden rounded-md p-2 text-muted-foreground hover:bg-accent sm:block"
                  aria-label={`Probar enlace de ${def.name}`}
                >
                  <ExternalLinkIcon className="size-4" aria-hidden />
                </a>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Subir"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUpIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Bajar"
                      disabled={i === networks.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDownIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Editar"
                      onClick={() => setEditing(r)}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar"
                      onClick={() =>
                        start(async () => {
                          const x = await deleteNetwork(slug, r.id)
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
          {networks
            .filter((r) => r.visible)
            .map((r) => (
              <li
                key={r.id}
                className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"
                title={`${networkBySlug(r.network).name} de ${officialName}`}
              >
                <NetworkIcon slug={r.network} className="size-5" />
              </li>
            ))}
        </ul>
      </div>
      {editing && (
        <NetworkDialog
          slug={slug}
          network={editing}
          subjects={subjects}
          close={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function NetworkDialog({
  slug,
  network: initial,
  subjects,
  close,
}: {
  slug: string
  network: Omit<Network, 'id'> & { id?: string }
  subjects: Subject[]
  close: () => void
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [network, setNetwork] = useState(initial.network)
  const [url, setUrl] = useState(initial.url)
  const [number, setNumber] = useState('')
  const [message, setMessage] = useState('')
  const [text, setText] = useState(initial.text ?? '')
  const [otherName, setOtherName] = useState(initial.otherName ?? '')
  const [subjectId, setSubjectId] = useState<string | null>(initial.obligatedSubjectId)
  const [visible, setVisible] = useState(initial.visible)
  const [blackout, setBlackout] = useState(initial.hideDuringBlackout)
  const detected = url ? detectNetwork(url) : null
  const validation = url && network !== 'whatsapp' ? validateLink(url, network) : null

  function paste(value: string) {
    setUrl(value)
    const d = detectNetwork(value)
    if (d && network !== 'otra') setNetwork(d.slug)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const r = await saveNetwork(slug, {
                id: initial.id,
                obligatedSubjectId: subjectId,
                network,
                otherName: network === 'otra' ? otherName || null : null,
                url: network === 'whatsapp' && !url ? 'https://wa.me/0' : url,
                whatsapp: network === 'whatsapp' && number ? { number, message } : undefined,
                text: text || null,
                visible,
                hideDuringBlackout: blackout,
              })
              if (!r.ok) {
                toast.error(r.error)
                return
              }
              toast.success(initial.id ? 'Red social actualizada' : 'Red social agregada')
              if (r.data.warning) toast.warning(r.data.warning)
              close()
              router.refresh()
            })
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{initial.id ? 'Editar red social' : 'Agregar red social'}</DialogTitle>
            <DialogDescription>
              Pega el enlace y reconocemos la red. Si tienen varias cuentas de la misma red, ponles
              un texto distinto.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1">
            <Label htmlFor="red">Red</Label>
            <select
              id="red"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="h-11 rounded-md border bg-background px-3"
            >
              {NETWORKS.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          {network === 'otra' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="nombreOtra">Nombre de la red</Label>
              <Input
                id="nombreOtra"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                required
                className="h-11"
              />
            </div>
          )}
          {network === 'whatsapp' ? (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="numero">Número de WhatsApp (10 dígitos)</Label>
                <Input
                  id="numero"
                  inputMode="tel"
                  placeholder="343 437 0001"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  required={!initial.id}
                  className="h-11"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="mensaje">Mensaje inicial (opcional)</Label>
                <Input
                  id="mensaje"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hola, quiero información sobre…"
                  className="h-11"
                />
              </div>
              {initial.url && (
                <p className="text-xs text-muted-foreground">Enlace actual: {initial.url}</p>
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
                onChange={(e) => paste(e.target.value)}
                placeholder="https://www.facebook.com/…"
                required
                className="h-11"
              />
              {detected && detected.slug !== network && network !== 'otra' && (
                <p className="text-xs text-amber-700">
                  Este enlace parece de {detected.name}, ¿es correcto?
                </p>
              )}
              {validation && !validation.ok && (
                <p className="text-xs text-destructive">{validation.error}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor="texto">Texto (opcional)</Label>
            <Input
              id="texto"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej. Facebook del DIF"
              maxLength={80}
              className="h-11"
            />
          </div>
          {subjects.length > 1 && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="sujeto">¿De quién es la cuenta?</Label>
              <select
                id="sujeto"
                value={subjectId ?? ''}
                onChange={(e) => setSubjectId(e.target.value || null)}
                className="h-11 rounded-md border bg-background px-3"
              >
                <option value="">Todo el municipio (Ayuntamiento)</option>
                {subjects
                  .filter((s) => !s.root)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
            <Checkbox checked={blackout} onCheckedChange={(v) => setBlackout(Boolean(v))} /> Ocultar
            durante la veda electoral
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
            <Button type="button" variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="h-11">
              {pending && <Loader2Icon className="animate-spin" aria-hidden />} Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
