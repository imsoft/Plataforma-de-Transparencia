import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'

export default async function Inicio() {
  const s = await obtenerSesion()
  redirect(s ? '/municipios' : '/iniciar-sesion')
}
