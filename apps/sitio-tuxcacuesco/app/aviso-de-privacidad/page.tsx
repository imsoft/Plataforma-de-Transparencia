import type { Metadata } from 'next'
import { municipioOFallback } from '@/lib/sitio'

export const metadata: Metadata = { title: 'Aviso de privacidad' }
export const revalidate = 86400

export default async function AvisoDePrivacidad() {
  const m = await municipioOFallback()
  return (
    <article className="prose mx-auto max-w-3xl px-4 py-10">
      <h1>Aviso de privacidad</h1>
      <p>
        El {m.nombreOficial} es responsable del tratamiento de los datos personales que se recaben a
        través de este sitio, conforme a la legislación aplicable en materia de protección de datos
        personales en posesión de sujetos obligados.
      </p>
      <p>
        Este sitio no recaba datos personales de los visitantes de forma automática más allá de los
        registros técnicos necesarios para su operación.
      </p>
    </article>
  )
}
