'use client'
import { Button } from '@platform/ui/components/button'
import { field } from '@/lib/form'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createMunicipality } from '@/actions/admin'

type Subject = { typeSlug: string; name: string; prefix: string }

export function MunicipalityForm({ types }: { types: { slug: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [subjects, setSubjects] = useState<Subject[]>([
    { typeSlug: 'ayuntamiento', name: '', prefix: '' },
  ])
  const slug = name
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
        start(async () => {
          const r = await createMunicipality({
            slug: field(f, 'slug'),
            name: field(f, 'name'),
            officialName: field(f, 'nombreOficial'),
            domain: field(f, 'domain'),
            primaryColor: field(f, 'colorPrimario'),
            secondaryColor: field(f, 'colorSecundario'),
            accentColor: field(f, 'colorAcento'),
            revalidationUrl: field(f, 'urlRevalidacion'),
            subjects: subjects.map((s) => ({
              ...s,
              name: s.name || (s.prefix ? s.typeSlug.toUpperCase() : `H. Ayuntamiento de ${name}`),
            })),
          })
          if (!r.ok) {
            toast.error(r.error)
            return
          }
          toast.success(`Municipio ${name} creado`)
          router.push(`/m/${r.data.slug}`)
          router.refresh()
        })
      }}
      className="flex flex-col gap-5 rounded-xl border bg-card p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre corto">
          <Input
            id="name"
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tuxcacuesco"
            className="h-11"
          />
        </Field>
        <Field id="slug" label="Identificador (URL y carpetas)">
          <Input
            id="slug"
            name="slug"
            required
            defaultValue={slug}
            key={slug}
            pattern="[a-z0-9-]{3,40}"
            className="h-11 font-mono"
          />
        </Field>
        <Field id="nombreOficial" label="Nombre oficial">
          <Input
            id="nombreOficial"
            name="nombreOficial"
            required
            defaultValue={name ? `H. Ayuntamiento de ${name}` : ''}
            key={`of-${name}`}
            className="h-11"
          />
        </Field>
        <Field id="domain" label="Dominio del sitio">
          <Input
            id="domain"
            name="domain"
            required
            placeholder="tuxcacuesco.gob.mx"
            className="h-11"
          />
        </Field>
        <Field id="urlRevalidacion" label="URL de revalidación (opcional)">
          <Input
            id="urlRevalidacion"
            name="urlRevalidacion"
            placeholder="https://tuxcacuesco.gob.mx/api/revalidate"
            className="h-11"
          />
        </Field>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-medium">
          Colores de identidad (se ajustan solos si no son legibles)
        </legend>
        <Field id="colorPrimario" label="Primario">
          <Input
            id="colorPrimario"
            name="colorPrimario"
            type="color"
            defaultValue="#125c6a"
            className="h-11 w-full p-1"
          />
        </Field>
        <Field id="colorSecundario" label="Secundario">
          <Input
            id="colorSecundario"
            name="colorSecundario"
            type="color"
            defaultValue="#35505e"
            className="h-11 w-full p-1"
          />
        </Field>
        <Field id="colorAcento" label="Acento">
          <Input
            id="colorAcento"
            name="colorAcento"
            type="color"
            defaultValue="#5b7a8c"
            className="h-11 w-full p-1"
          />
        </Field>
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">Sujetos obligados</legend>
        {subjects.map((s, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]"
          >
            <select
              value={s.typeSlug}
              onChange={(e) =>
                setSubjects((p) =>
                  p.map((x, j) => (j === i ? { ...x, typeSlug: e.target.value } : x)),
                )
              }
              className="h-11 rounded-md border bg-background px-3"
              aria-label="Tipo"
            >
              {types.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
            <Input
              value={s.name}
              onChange={(e) =>
                setSubjects((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
              placeholder={i === 0 ? `H. Ayuntamiento de ${name || '…'}` : 'DIF Municipal'}
              aria-label="Nombre"
              className="h-11"
            />
            <Input
              value={s.prefix}
              onChange={(e) =>
                setSubjects((p) =>
                  p.map((x, j) => (j === i ? { ...x, prefix: e.target.value.toLowerCase() } : x)),
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
              onClick={() => setSubjects((p) => p.filter((_, j) => j !== i))}
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
          onClick={() => setSubjects((p) => [...p, { typeSlug: 'dif', name: '', prefix: 'dif' }])}
        >
          <PlusIcon aria-hidden /> Agregar sujeto obligado
        </Button>
      </fieldset>
      <Button type="submit" disabled={pending} className="h-11 self-start">
        {pending && <Loader2Icon className="animate-spin" aria-hidden />} Crear municipio
      </Button>
    </form>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
