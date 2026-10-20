'use client'
import { normalizeKey } from '@platform/law-index'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@platform/ui/components/command'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

export type SearchableNode = {
  id: string
  key: string | null
  label: string
  title: string
  subject: string
  href: string
}

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function NodeSearch({ nodes }: { nodes: SearchableNode[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const results = useMemo(() => {
    const t = text.trim()
    if (!t) return []
    const key = normalizeKey(t)
    const words = stripAccents(t).split(/\s+/).filter(Boolean)
    return nodes
      .map((n) => {
        let score = 0
        if (key && n.key === key) score += 100
        else if (key && n.key?.startsWith(key)) score += 40
        const haystack = stripAccents(`${n.title} ${n.label}`)
        if (words.every((p) => haystack.includes(p))) score += 20 + words.length * 5
        return { n, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
  }, [text, nodes])

  const hasText = text.trim().length > 0
  return (
    <Command
      shouldFilter={false}
      className="rounded-xl border shadow-sm"
      label="Buscar sección del índice"
    >
      <CommandInput
        placeholder="Escribe la clave (85a) o palabras: estados financieros, actas, nómina…"
        value={text}
        onValueChange={setText}
        className="h-12 text-base"
      />
      <CommandList className={hasText ? undefined : 'hidden'} aria-hidden={!hasText}>
        {hasText && (
          <CommandEmpty>
            No encontramos esa sección. Prueba con otras palabras o revisa la clave.
          </CommandEmpty>
        )}
        {hasText && results.length > 0 && (
          <CommandGroup heading="Secciones">
            {results.map(({ n }) => (
              <CommandItem
                key={n.id}
                value={n.id}
                onSelect={() => router.push(n.href)}
                className="cursor-pointer py-2.5"
              >
                <span className="w-14 shrink-0 font-mono text-sm text-primary">{n.key ?? '—'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {n.label} · {n.subject}
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
