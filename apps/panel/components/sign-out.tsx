'use client'
import { Button } from '@platform/ui/components/button'
import { LogOutIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function SignOut() {
  const router = useRouter()
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await authClient.signOut()
        router.push('/iniciar-sesion')
        router.refresh()
      }}
    >
      <LogOutIcon aria-hidden />
      Salir
    </Button>
  )
}
