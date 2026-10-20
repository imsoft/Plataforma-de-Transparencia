/** Lee un campo de texto de un FormData (los archivos no cuentan). */
export function field(data: FormData, name: string): string {
  const v = data.get(name)
  return typeof v === 'string' ? v : ''
}
