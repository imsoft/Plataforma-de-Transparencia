'use client'
import {
  ajustes,
  contraste,
  legibleSobre,
  TIPOGRAFIAS,
  textoSobre,
  type Tema,
} from '@plataforma/tema'
import { Button } from '@plataforma/ui/components/button'
import { Input } from '@plataforma/ui/components/input'
import { Label } from '@plataforma/ui/components/label'
import { Loader2Icon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  confirmarImagenIdentidad,
  guardarIdentidad,
  prepararImagenIdentidad,
} from '@/acciones/identidad'
import { campo } from '@/lib/formulario'

type Contacto = { direccion?: string; telefono?: string; correo?: string; horario?: string }

export function FormularioIdentidad({
  slug,
  tema: inicial,
  escudoUrl,
  logoUrl,
  contacto,
  puedeEditar,
}: {
  slug: string
  tema: Tema
  escudoUrl: string | null
  logoUrl: string | null
  contacto: Contacto
  puedeEditar: boolean
}) {
  const router = useRouter()
  const [tema, setTema] = useState<Tema>(inicial)
  const [pendiente, iniciar] = useTransition()
  const avisos = ajustes(tema)

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const f = new FormData(e.currentTarget)
          iniciar(async () => {
            const r = await guardarIdentidad(slug, {
              ...tema,
              datosContacto: {
                direccion: campo(f, 'direccion'),
                telefono: campo(f, 'telefono'),
                correo: campo(f, 'correo'),
                horario: campo(f, 'horario'),
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
            {(['colorPrimario', 'colorSecundario', 'colorAcento'] as const).map((campo) => (
              <div key={campo} className="flex items-center gap-3">
                <Input
                  type="color"
                  value={tema[campo]}
                  disabled={!puedeEditar}
                  onChange={(e) => setTema((t) => ({ ...t, [campo]: e.target.value }))}
                  aria-label={ETIQUETA[campo]}
                  className="size-11 shrink-0 p-1"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{ETIQUETA[campo]}</p>
                  <p className="font-mono text-xs text-muted-foreground">{tema[campo]}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-1">
              <Label htmlFor="tipografia">Tipografía</Label>
              <select
                id="tipografia"
                value={tema.tipografia}
                disabled={!puedeEditar}
                onChange={(e) =>
                  setTema((t) => ({ ...t, tipografia: e.target.value as Tema['tipografia'] }))
                }
                className="h-11 rounded-md border bg-background px-3"
              >
                {TIPOGRAFIAS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <VistaPrevia tema={tema} />
          {avisos.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:bg-amber-950/40 dark:text-amber-100">
              {avisos
                .map(
                  (a) =>
                    `${ETIQUETA[a.campo]} (${a.original}) no se lee bien sobre blanco (contraste ${a.contrasteOriginal}:1); en textos y botones se usará ${a.ajustado}.`,
                )
                .join(' ')}
            </p>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">
            Datos de contacto (pie de página y Google)
          </h2>
          <Campo
            id="direccion"
            etiqueta="Dirección"
            defaultValue={contacto.direccion}
            disabled={!puedeEditar}
          />
          <Campo
            id="telefono"
            etiqueta="Teléfono"
            defaultValue={contacto.telefono}
            disabled={!puedeEditar}
          />
          <Campo
            id="correo"
            etiqueta="Correo"
            defaultValue={contacto.correo}
            type="email"
            disabled={!puedeEditar}
          />
          <Campo
            id="horario"
            etiqueta="Horario de atención"
            defaultValue={contacto.horario}
            disabled={!puedeEditar}
          />
        </section>
        {puedeEditar && (
          <Button type="submit" disabled={pendiente} className="h-11 self-start">
            {pendiente && <Loader2Icon className="animate-spin" aria-hidden />} Guardar cambios
          </Button>
        )}
      </form>

      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Imagen
          slug={slug}
          campo="escudo"
          etiqueta="Escudo del municipio"
          url={escudoUrl}
          puedeEditar={puedeEditar}
        />
        <Imagen
          slug={slug}
          campo="logoAdministracion"
          etiqueta="Logo de la administración"
          url={logoUrl}
          puedeEditar={puedeEditar}
        />
      </section>
    </div>
  )
}

const ETIQUETA = {
  colorPrimario: 'Color primario',
  colorSecundario: 'Color secundario',
  colorAcento: 'Color de acento',
  tipografia: 'Tipografía',
} as const

function VistaPrevia({ tema }: { tema: Tema }) {
  const p = legibleSobre(tema.colorPrimario, '#ffffff')
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border bg-white p-4 text-neutral-900"
      style={{ fontFamily: tema.tipografia }}
    >
      <p className="text-xs text-neutral-500">Así se ve en el sitio público</p>
      <div className="h-2 rounded" style={{ background: p }} />
      <p className="font-semibold" style={{ color: p }}>
        H. Ayuntamiento · Transparencia
      </p>
      <button
        type="button"
        className="h-10 rounded-md px-4 text-sm font-medium"
        style={{ background: p, color: textoSobre(p) }}
      >
        Ver documentos
      </button>
      <p className="text-xs text-neutral-500">
        Contraste del primario sobre blanco: {Math.round(contraste(p, '#ffffff') * 10) / 10}:1
      </p>
    </div>
  )
}

function Campo({
  id,
  etiqueta,
  defaultValue,
  type = 'text',
  disabled,
}: {
  id: string
  etiqueta: string
  defaultValue?: string
  type?: string
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{etiqueta}</Label>
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

function Imagen({
  slug,
  campo,
  etiqueta,
  url,
  puedeEditar,
}: {
  slug: string
  campo: 'escudo' | 'logoAdministracion'
  etiqueta: string
  url: string | null
  puedeEditar: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [ocupado, setOcupado] = useState(false)
  async function subir(file: File) {
    setOcupado(true)
    try {
      const p = await prepararImagenIdentidad({
        slug,
        campo,
        nombreArchivo: file.name,
        tamano: file.size,
      })
      if (!p.ok) return toast.error(p.error)
      const r = await fetch(p.datos.url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': p.datos.contentType, 'Content-Disposition': 'inline' },
      })
      if (!r.ok) return toast.error('No se pudo subir la imagen. Intenta de nuevo.')
      const c = await confirmarImagenIdentidad(slug, campo, p.datos.rutaTemporal)
      if (!c.ok) return toast.error(c.error)
      toast.success('Imagen actualizada')
      router.refresh()
    } finally {
      setOcupado(false)
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
        <p className="text-sm font-medium">{etiqueta}</p>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP o SVG · máx. 5 MB</p>
        {puedeEditar && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.svg"
              className="sr-only"
              onChange={(e) => e.target.files?.[0] && void subir(e.target.files[0])}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={ocupado}
              onClick={() => inputRef.current?.click()}
            >
              {ocupado ? (
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
