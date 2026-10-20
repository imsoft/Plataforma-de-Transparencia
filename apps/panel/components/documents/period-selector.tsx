'use client'
import { periodOf, type PeriodicFrequency, type Period } from '@platform/law-index'
import { Label } from '@platform/ui/components/label'
import { useId } from 'react'

const MONTHS = [
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
const selectClass = 'h-11 rounded-md border bg-background px-3 text-base'

export type ChosenPeriod = {
  label: string | null
  start: string | null
  end: string | null
  folder: string
}

export const NO_PERIOD: ChosenPeriod = {
  label: null,
  start: null,
  end: null,
  folder: 'permanent',
}

export function chosenPeriod(
  frequency: PeriodicFrequency,
  year: number,
  part: number,
): ChosenPeriod {
  const month =
    frequency === 'monthly'
      ? part
      : frequency === 'quarterly'
        ? (part - 1) * 3 + 1
        : frequency === 'semiannual'
          ? (part - 1) * 6 + 1
          : 1
  const p: Period = periodOf(frequency, `${year}-${String(month).padStart(2, '0')}-01`)
  return { label: p.label, start: p.start, end: p.end, folder: p.folder }
}

/** Selector simple de periodo según la periodicidad del nodo. */
export function PeriodSelector({
  frequency,
  year,
  part,
  onChange,
}: {
  frequency: PeriodicFrequency
  year: number
  part: number
  onChange: (year: number, part: number) => void
}) {
  const id = useId()
  const today = new Date().getFullYear()
  const years = Array.from({ length: 8 }, (_, i) => today + 1 - i)
  const parts =
    frequency === 'monthly'
      ? MONTHS.map((m, i) => [i + 1, m] as const)
      : frequency === 'quarterly'
        ? ([
            [1, '1er trimestre'],
            [2, '2do trimestre'],
            [3, '3er trimestre'],
            [4, '4to trimestre'],
          ] as const)
        : frequency === 'semiannual'
          ? ([
              [1, '1er semestre'],
              [2, '2do semestre'],
            ] as const)
          : null
  return (
    <div className="flex flex-wrap items-end gap-2">
      {parts && (
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-parte`}>
            {frequency === 'monthly' ? 'Mes' : frequency === 'quarterly' ? 'Trimestre' : 'Semestre'}
          </Label>
          <select
            id={`${id}-parte`}
            className={selectClass}
            value={part}
            onChange={(e) => onChange(year, Number(e.target.value))}
          >
            {parts.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-anio`}>{frequency === 'annual' ? 'Ejercicio' : 'Año'}</Label>
        <select
          id={`${id}-anio`}
          className={selectClass}
          value={year}
          onChange={(e) => onChange(Number(e.target.value), part)}
        >
          {years.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
