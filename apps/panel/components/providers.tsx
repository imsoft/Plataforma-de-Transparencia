'use client'
import { Toaster } from '@platform/ui/components/sonner'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@platform/ui/components/tooltip'

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
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
