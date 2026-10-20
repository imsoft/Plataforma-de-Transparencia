import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { exigirSesion } from '@/lib/sesion'

export default async function LayoutCuenta({ children }: { children: React.ReactNode }) {
  await exigirSesion()
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-8">
      <Link
        href="/municipios"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Volver
      </Link>
      {children}
    </main>
  )
}
