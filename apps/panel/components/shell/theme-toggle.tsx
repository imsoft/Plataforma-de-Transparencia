'use client'
import { Button } from '@platform/ui/components/button'
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {dark ? <SunIcon aria-hidden /> : <MoonIcon aria-hidden />}
    </Button>
  )
}
