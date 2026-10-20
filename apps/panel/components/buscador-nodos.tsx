'use client'
import { normalizarClave } from '@plataforma/indice'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@plataforma/ui/components/command'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

export type NodoBuscable = {
  id: string
  clave: string | null
  etiqueta: string
  titulo: string
  sujeto: string
  href: string
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function BuscadorNodos({ nodos }: { nodos: NodoBuscable[] }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const resultados = useMemo(() => {
    const t = texto.trim()
    if (!t) return []
    const clave = normalizarClave(t)
    const palabras = quitarAcentos(t).split(/\s+/).filter(Boolean)
    return nodos
      .map((n) => {
        let puntos = 0
        if (clave && n.clave === clave) puntos += 100
        else if (clave && n.clave?.startsWith(clave)) puntos += 40
        const haystack = quitarAcentos(`${n.titulo} ${n.etiqueta}`)
        if (palabras.every((p) => haystack.includes(p))) puntos += 20 + palabras.length * 5
        return { n, puntos }
      })
      .filter((r) => r.puntos > 0)
      .sort((a, b) => b.puntos - a.puntos)
      .slice(0, 12)
  }, [texto, nodos])

  const hayTexto = texto.trim().length > 0
  return (
    <Command
      shouldFilter={false}
      className="rounded-xl border shadow-sm"
      label="Buscar sección del índice"
    >
      <CommandInput
        placeholder="Escribe la clave (85a) o palabras: estados financieros, actas, nómina…"
        value={texto}
        onValueChange={setTexto}
        className="h-12 text-base"
      />
      <CommandList className={hayTexto ? undefined : 'hidden'} aria-hidden={!hayTexto}>
        {hayTexto && (
          <CommandEmpty>
            No encontramos esa sección. Prueba con otras palabras o revisa la clave.
          </CommandEmpty>
        )}
        {hayTexto && resultados.length > 0 && (
          <CommandGroup heading="Secciones">
            {resultados.map(({ n }) => (
              <CommandItem
                key={n.id}
                value={n.id}
                onSelect={() => router.push(n.href)}
                className="cursor-pointer py-2.5"
              >
                <span className="w-14 shrink-0 font-mono text-sm text-primary">
                  {n.clave ?? '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{n.titulo}</span>
                  <span className="block text-xs text-muted-foreground">
                    {n.etiqueta} · {n.sujeto}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
