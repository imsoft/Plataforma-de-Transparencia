/** Lee un campo de texto de un FormData (los archivos no cuentan). */
export function campo(datos: FormData, nombre: string): string {
  const v = datos.get(nombre)
  return typeof v === 'string' ? v : ''
}
