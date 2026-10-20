'use client'
import { Button } from '@plataforma/ui/components/button'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

export function CambiarTema() {
  const { resolvedTheme, setTheme } = useTheme()
  const montado = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const oscuro = montado && resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(oscuro ? 'light' : 'dark')}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {oscuro ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  )
}
