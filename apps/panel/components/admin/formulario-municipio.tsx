'use client'
import { Button } from '@plataforma/ui/components/button'
import { campo } from '@/lib/formulario'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { crearMunicipio } from '@/acciones/admin'

type Sujeto = { tipoSlug: string; nombre: string; prefijo: string }

export function FormularioMunicipio({ tipos }: { tipos: { slug: string; nombre: string }[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [nombre, setNombre] = useState('')
  const [sujetos, setSujetos] = useState<Sujeto[]>([
    { tipoSlug: 'ayuntamiento', nombre: '', prefijo: '' },
  ])
  const slug = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        iniciar(async () => {
          const r = await crearMunicipio({
            slug: campo(f, 'slug'),
            nombre: campo(f, 'nombre'),
            nombreOficial: campo(f, 'nombreOficial'),
            dominio: campo(f, 'dominio'),
            colorPrimario: campo(f, 'colorPrimario'),
            colorSecundario: campo(f, 'colorSecundario'),
            colorAcento: campo(f, 'colorAcento'),
            urlRevalidacion: campo(f, 'urlRevalidacion'),
            sujetos: sujetos.map((s) => ({
              ...s,
              nombre:
                s.nombre || (s.prefijo ? s.tipoSlug.toUpperCase() : `H. Ayuntamiento de ${nombre}`),
            })),
          })
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success(`Municipio ${nombre} creado`)
          router.push(`/m/${r.datos.slug}`)
          router.refresh()
        })
      }}
      className="flex flex-col gap-5 rounded-xl border bg-card p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo id="nombre" etiqueta="Nombre corto">
          <Input
            id="nombre"
            name="nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tuxcacuesco"
            className="h-11"
          />
        </Campo>
        <Campo id="slug" etiqueta="Identificador (URL y carpetas)">
          <Input
            id="slug"
            name="slug"
            required
            defaultValue={slug}
            key={slug}
            pattern="[a-z0-9-]{3,40}"
            className="h-11 font-mono"
          />
        </Campo>
        <Campo id="nombreOficial" etiqueta="Nombre oficial">
          <Input
            id="nombreOficial"
            name="nombreOficial"
            required
            defaultValue={nombre ? `H. Ayuntamiento de ${nombre}` : ''}
            key={`of-${nombre}`}
            className="h-11"
          />
        </Campo>
        <Campo id="dominio" etiqueta="Dominio del sitio">
          <Input
            id="dominio"
            name="dominio"
            required
            placeholder="tuxcacuesco.gob.mx"
            className="h-11"
          />
        </Campo>
        <Campo id="urlRevalidacion" etiqueta="URL de revalidación (opcional)">
          <Input
            id="urlRevalidacion"
            name="urlRevalidacion"
            placeholder="https://tuxcacuesco.gob.mx/api/revalidar"
            className="h-11"
          />
        </Campo>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">
          Colores de identidad (se ajustan solos si no son legibles)
        </legend>
        <Campo id="colorPrimario" etiqueta="Primario">
          <Input
            id="colorPrimario"
            name="colorPrimario"
            type="color"
            defaultValue="#125c6a"
            className="h-11 w-full p-1"
          />
        </Campo>
        <Campo id="colorSecundario" etiqueta="Secundario">
          <Input
            id="colorSecundario"
            name="colorSecundario"
            type="color"
            defaultValue="#35505e"
            className="h-11 w-full p-1"
          />
        </Campo>
        <Campo id="colorAcento" etiqueta="Acento">
          <Input
            id="colorAcento"
            name="colorAcento"
            type="color"
            defaultValue="#5b7a8c"
            className="h-11 w-full p-1"
          />
        </Campo>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Sujetos obligados</legend>
        {sujetos.map((s, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
          >
            <select
              value={s.tipoSlug}
              onChange={(e) =>
                setSujetos((p) =>
                  p.map((x, j) => (j === i ? { ...x, tipoSlug: e.target.value } : x)),
                )
              }
              className="h-11 rounded-md border bg-background px-3"
              aria-label="Tipo"
            >
              {tipos.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <Input
              value={s.nombre}
              onChange={(e) =>
                setSujetos((p) => p.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
              }
              placeholder={i === 0 ? `H. Ayuntamiento de ${nombre || '…'}` : 'DIF Municipal'}
              aria-label="Nombre"
              className="h-11"
            />
            <Input
              value={s.prefijo}
              onChange={(e) =>
                setSujetos((p) =>
                  p.map((x, j) => (j === i ? { ...x, prefijo: e.target.value.toLowerCase() } : x)),
                )
              }
              placeholder={i === 0 ? '(raíz)' : 'dif'}
              disabled={i === 0}
              aria-label="Prefijo de URL"
              className="h-11 font-mono"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={i === 0}
              aria-label="Quitar"
              onClick={() => setSujetos((p) => p.filter((_, j) => j !== i))}
            >
              <XIcon aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setSujetos((p) => [...p, { tipoSlug: 'dif', nombre: '', prefijo: 'dif' }])}
        >
          <PlusIcon aria-hidden /> Agregar sujeto obligado
        </Button>
      </fieldset>
      <Button type="submit" disabled={pendiente} className="h-11 self-start">
        {pendiente && <Loader2Icon className="animate-spin" aria-hidden />} Crear municipio
      </Button>
    </form>
  )
}

function Campo({
  id,
  etiqueta,
  children,
}: {
  id: string
  etiqueta: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
    </div>
  )
}
