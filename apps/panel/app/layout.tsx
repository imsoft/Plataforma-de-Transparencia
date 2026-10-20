import '@platform/ui/globals.css'
import { cn } from '@platform/ui/lib/utils'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import { Providers } from '@/components/providers'
import { env } from '@/lib/env'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: env.NEXT_PUBLIC_PLATFORM_NAME,
    template: `%s · ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
  },
  robots: { index: false, follow: false },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // next-themes inyecta un script inline para aplicar el tema antes de hidratar: necesita el nonce de la CSP
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={cn('antialiased font-sans', inter.variable)}
    >
      <body className="min-h-dvh bg-background text-foreground">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  )
}
