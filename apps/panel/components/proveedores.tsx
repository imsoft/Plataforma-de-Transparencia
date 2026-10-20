'use client'
import { Toaster } from '@plataforma/ui/components/sonner'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@plataforma/ui/components/tooltip'

export function Proveedores({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster position="bottom-center" richColors closeButton />
    </ThemeProvider>
  )
}
