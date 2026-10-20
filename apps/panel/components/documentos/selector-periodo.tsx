'use client'
import { periodoDe, type PeriodicidadConPeriodo, type Periodo } from '@plataforma/indice'
import { Label } from '@plataforma/ui/components/label'
import { useId } from 'react'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
const selectClase = 'h-11 rounded-md border bg-background px-3 text-base'

export type PeriodoElegido = {
  etiqueta: string | null
  inicio: string | null
  fin: string | null
  carpeta: string
}

export const SIN_PERIODO: PeriodoElegido = {
  etiqueta: null,
  inicio: null,
  fin: null,
  carpeta: 'permanente',
}

export function periodoElegido(
  periodicidad: PeriodicidadConPeriodo,
  anio: number,
  parte: number,
): PeriodoElegido {
  const mes =
    periodicidad === 'mensual'
      ? parte
      : periodicidad === 'trimestral'
        ? (parte - 1) * 3 + 1
        : periodicidad === 'semestral'
          ? (parte - 1) * 6 + 1
          : 1
  const p: Periodo = periodoDe(periodicidad, `${anio}-${String(mes).padStart(2, '0')}-01`)
  return { etiqueta: p.etiqueta, inicio: p.inicio, fin: p.fin, carpeta: p.carpeta }
}

/** Selector simple de periodo según la periodicidad del nodo. */
export function SelectorPeriodo({
  periodicidad,
  anio,
  parte,
  onChange,
}: {
  periodicidad: PeriodicidadConPeriodo
  anio: number
  parte: number
  onChange: (anio: number, parte: number) => void
}) {
  const id = useId()
  const hoy = new Date().getFullYear()
  const anios = Array.from({ length: 8 }, (_, i) => hoy + 1 - i)
  const partes =
    periodicidad === 'mensual'
      ? MESES.map((m, i) => [i + 1, m] as const)
      : periodicidad === 'trimestral'
        ? ([
            [1, '1er trimestre'],
            [2, '2do trimestre'],
            [3, '3er trimestre'],
            [4, '4to trimestre'],
          ] as const)
        : periodicidad === 'semestral'
          ? ([
              [1, '1er semestre'],
              [2, '2do semestre'],
            ] as const)
          : null
  return (
    <div className="flex flex-wrap items-end gap-2">
      {partes && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-parte`}>
            {periodicidad === 'mensual'
              ? 'Mes'
              : periodicidad === 'trimestral'
                ? 'Trimestre'
                : 'Semestre'}
          </Label>
          <select
            id={`${id}-parte`}
            className={selectClase}
            value={parte}
            onChange={(e) => onChange(anio, Number(e.target.value))}
          >
            {partes.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-anio`}>{periodicidad === 'anual' ? 'Ejercicio' : 'Año'}</Label>
        <select
          id={`${id}-anio`}
          className={selectClase}
          value={anio}
          onChange={(e) => onChange(Number(e.target.value), parte)}
        >
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
