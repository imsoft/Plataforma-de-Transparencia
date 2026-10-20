import type { Cobertura } from '@plataforma/db/consultas/documentos'
import {
  CONFIG_SEMAFORO_DEFAULT,
  estadoNodo,
  type Periodicidad,
  type ResultadoSemaforo,
} from '@plataforma/indice'
import { hoyMexico } from './fechas'

export function semaforoDe(
  nodo: { periodicidad: Periodicidad },
  cobertura: Cobertura | undefined,
  hoy = hoyMexico(),
): ResultadoSemaforo {
  return estadoNodo(
    {
      periodicidad: nodo.periodicidad,
      periodosCubiertos: cobertura?.periodos ?? [],
      tieneDocumentos: (cobertura?.total ?? 0) > 0,
    },
    hoy,
    CONFIG_SEMAFORO_DEFAULT,
  )
}
