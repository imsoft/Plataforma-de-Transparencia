import { env } from '@/lib/env'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div
          aria-hidden
          className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold"
        >
          T
        </div>
        <h1 className="text-xl font-semibold">{env.NEXT_PUBLIC_PLATFORM_NAME}</h1>
      </div>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Acceso solo para personal autorizado de los municipios.
      </p>
    </main>
  )
}
