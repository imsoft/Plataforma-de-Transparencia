import { allMunicipalities } from '@platform/db/queries/session'
import type { Metadata } from 'next'
import { listSupervisors } from '@/actions/admin'
import { AssignSupervisor } from '@/components/admin/supervisors'

export const metadata: Metadata = { title: 'Supervisores' }

export default async function SupervisorsPage() {
  const [supervisors, municipalities] = await Promise.all([listSupervisors(), allMunicipalities()])
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Supervisores</h1>
        <p className="text-sm text-muted-foreground">
          Personas externas que ven y publican en varios municipios. El supervisor debe tener cuenta
          (acepta una invitación o crea su cuenta primero).
        </p>
      </div>
      <AssignSupervisor
        municipalities={municipalities.map((m) => ({ id: m.id, name: m.name }))}
        supervisors={supervisors}
      />
    </div>
  )
}
