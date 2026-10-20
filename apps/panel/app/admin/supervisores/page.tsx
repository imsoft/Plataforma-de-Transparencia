import { todosLosMunicipios } from '@plataforma/db/consultas/sesion'
import type { Metadata } from 'next'
import { listarSupervisores } from '@/acciones/admin'
import { AsignarSupervisor } from '@/components/admin/supervisores'

export const metadata: Metadata = { title: 'Supervisores' }

export default async function PaginaSupervisores() {
  const [supervisores, municipios] = await Promise.all([listarSupervisores(), todosLosMunicipios()])
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Supervisores</h1>
        <p className="text-sm text-muted-foreground">
          Personas externas que ven y publican en varios municipios. El supervisor debe tener cuenta
          (acepta una invitación o crea su cuenta primero).
        </p>
      </div>
      <AsignarSupervisor
        municipios={municipios.map((m) => ({ id: m.id, nombre: m.nombre }))}
        supervisores={supervisores}
      />
    </div>
  )
}
