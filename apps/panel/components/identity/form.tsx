'use client'
import {
  adjustments,
  contrastRatio,
  readableOn,
  TYPEFACES,
  textOn,
  type Theme,
} from '@platform/theme'
import { Button } from '@platform/ui/components/button'
import { Input } from '@platform/ui/components/input'
import { Label } from '@platform/ui/components/label'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { confirmIdentityImage, saveIdentity, prepareIdentityImage } from '@/actions/identity'
import { field } from '@/lib/form'

type Contact = { address?: string; phone?: string; email?: string; hours?: string }

export function IdentityForm({
  slug,
  theme: initial,
  coatOfArmsUrl,
  logoUrl,
  contact,
  canEdit,
}: {
  slug: string
  theme: Theme
  coatOfArmsUrl: string | null
  logoUrl: string | null
  contact: Contact
  canEdit: boolean
}) {
  const router = useRouter()
  const [theme, setThemeValue] = useState<Theme>(initial)
  const [pending, start] = useTransition()
  const warningList = adjustments(theme)

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          start(async () => {
            const r = await saveIdentity(slug, {
              ...theme,
              contactInfo: {
                address: field(f, 'address'),
                phone: field(f, 'phone'),
                email: field(f, 'email'),
                hours: field(f, 'hours'),
              },
            })
            if (!r.ok) {
              toast.error(r.error)
              return
            }
            toast.success('Identidad guardada. El sitio público ya muestra los cambios.')
            router.refresh()
          })
        }}
        className="flex flex-col gap-6"
      >
        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-4">
            {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((field) => (
              <div key={field} className="flex items-center gap-3">
                <Input
                  type="color"
                  value={theme[field]}
                  disabled={!canEdit}
                  onChange={(e) => setThemeValue((t) => ({ ...t, [field]: e.target.value }))}
                  aria-label={LABEL[field]}
                  className="size-11 shrink-0 p-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{LABEL[field]}</p>
                  <p className="font-mono text-xs text-muted-foreground">{theme[field]}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <Label htmlFor="tipografia">Tipografía</Label>
              <select
                id="tipografia"
                value={theme.typeface}
                disabled={!canEdit}
                onChange={(e) =>
                  setThemeValue((t) => ({ ...t, typeface: e.target.value as Theme['typeface'] }))
                }
                className="h-11 rounded-md border bg-background px-3"
              >
                {TYPEFACES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Preview theme={theme} />
          {warningList.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:bg-amber-950/40 dark:text-amber-100">
              {warningList
                .map(
                  (a) =>
                    `${LABEL[a.field]} (${a.original}) no se lee bien sobre blanco (contraste ${a.originalContrast}:1); en textos y botones se usará ${a.adjusted}.`,
                )
                .join(' ')}
            </p>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">
            Datos de contacto (pie de página y Google)
          </h2>
          <Field
            id="address"
            label="Dirección"
            defaultValue={contact.address}
            disabled={!canEdit}
          />
          <Field id="phone" label="Teléfono" defaultValue={contact.phone} disabled={!canEdit} />
          <Field
            id="email"
            label="Correo"
            defaultValue={contact.email}
            type="email"
            disabled={!canEdit}
          />
          <Field
            id="hours"
            label="Horario de atención"
            defaultValue={contact.hours}
            disabled={!canEdit}
          />
        </section>
        {canEdit && (
          <Button type="submit" disabled={pending} className="h-11 self-start">
            {pending && <Loader2Icon className="animate-spin" aria-hidden />} Guardar cambios
          </Button>
        )}
      </form>

      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <ImageField
          slug={slug}
          field="coatOfArms"
          label="Escudo del municipio"
          url={coatOfArmsUrl}
          canEdit={canEdit}
        />
        <ImageField
          slug={slug}
          field="administrationLogo"
          label="Logo de la administración"
          url={logoUrl}
          canEdit={canEdit}
        />
      </section>
    </div>
  )
}

const LABEL = {
  primaryColor: 'Color primario',
  secondaryColor: 'Color secundario',
  accentColor: 'Color de acento',
  typeface: 'Tipografía',
} as const

function Preview({ theme }: { theme: Theme }) {
  const p = readableOn(theme.primaryColor, '#ffffff')
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-white p-4 text-neutral-900"
      style={{ fontFamily: theme.typeface }}
    >
      <p className="text-xs text-neutral-500">Así se ve en el sitio público</p>
      <div className="h-2 rounded" style={{ background: p }} />
      <p className="font-semibold" style={{ color: p }}>
        H. Ayuntamiento · Transparencia
      </p>
      <button
        type="button"
        className="h-10 rounded-md px-4 text-sm font-medium"
        style={{ background: p, color: textOn(p) }}
      >
        Ver documentos
      </button>
      <p className="text-xs text-neutral-500">
        Contraste del primario sobre blanco: {Math.round(contrastRatio(p, '#ffffff') * 10) / 10}:1
      </p>
    </div>
  )
}

function Field({
  id,
  label,
  defaultValue,
  type = 'text',
  disabled,
}: {
  id: string
  label: string
  defaultValue?: string
  type?: string
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue ?? ''}
        disabled={disabled}
        className="h-11"
      />
    </div>
  )
}

function ImageField({
  slug,
  field,
  label,
  url,
  canEdit,
}: {
  slug: string
  field: 'coatOfArms' | 'administrationLogo'
  label: string
  url: string | null
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function uploadFlag(file: File) {
    setBusy(true)
    try {
      const p = await prepareIdentityImage({
        slug,
        field,
        fileName: file.name,
        size: file.size,
      })
      if (!p.ok) return toast.error(p.error)
      const r = await fetch(p.data.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': p.data.contentType, 'Content-Disposition': 'inline' },
      })
      if (!r.ok) return toast.error('No se pudo subir la imagen. Intenta de nuevo.')
      const c = await confirmIdentityImage(slug, field, p.data.tempPath)
      if (!c.ok) return toast.error(c.error)
      toast.success('Imagen actualizada')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-4">
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white">
        {}
        {url ? (
          <img src={url} alt="" className="size-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Sin imagen</span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB</p>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && void uploadFlag(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2Icon className="animate-spin" aria-hidden />
              ) : (
                <UploadIcon aria-hidden />
              )}{' '}
              {url ? 'Cambiar' : 'Subir'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
