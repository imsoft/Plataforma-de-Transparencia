'use client'
import { Button } from '@plataforma/ui/components/button'
import { LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authCliente } from '@/lib/auth-cliente'

export function CerrarSesion() {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await authCliente.signOut()
        router.push('/iniciar-sesion')
        router.refresh()
      }}
    >
      <LogOutIcon aria-hidden />
      Salir
    </Button>
  )
}
