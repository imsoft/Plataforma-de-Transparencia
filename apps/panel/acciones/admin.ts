'use server'
import { exigirSuperadmin } from '@plataforma/auth'
import { contextoDb } from '@plataforma/auth'
import {
  and,
  conUsuario,
  eq,
  estados,
  indiceVersiones,
  member,
  municipioDominios,
  municipioTema,
  municipios,
  organization,
  sujetosObligados,
  tiposSujetoObligado,
  user as tablaUser,
} from '@plataforma/db'
import { cargarIndice, publicarVersion } from '@plataforma/indice/cargar'
import { esRutaReservada } from '@plataforma/transparencia/rutas'
import { readFile, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { exigirSesion } from '@/lib/sesion'
import { accion, ErrorUsuario } from './comun'

async function superadmin() {
  const s = await exigirSesion()
  exigirSuperadmin(s)
  return { s, ctx: contextoDb(s) }
}

const municipioSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]{3,40}$/, 'El identificador solo lleva minúsculas, números y guiones.'),
  nombre: z.string().trim().min(2).max(80),
  nombreOficial: z.string().trim().min(5).max(120),
  dominio: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Escribe el dominio sin https:// (ej. tuxcacuesco.gob.mx)'),
  estadoClave: z.string().default('JAL'),
  colorPrimario: z.string().regex(/^#[0-9a-f]{6}$/i),
  colorSecundario: z.string().regex(/^#[0-9a-f]{6}$/i),
  colorAcento: z.string().regex(/^#[0-9a-f]{6}$/i),
  urlRevalidacion: z.string().url().optional().or(z.literal('')),
  sujetos: z
    .array(
      z.object({
        tipoSlug: z.string(),
        nombre: z.string().trim().min(2),
        prefijo: z.string().regex(/^[a-z0-9-]*$/),
      }),
    )
    .min(1),
})

export async function crearMunicipio(entrada: z.input<typeof municipioSchema>) {
  return accion(async () => {
    const { ctx } = await superadmin()
    const e = municipioSchema.parse(entrada)
    for (const so of e.sujetos)
      if (so.prefijo && esRutaReservada(so.prefijo))
        throw new ErrorUsuario(`El prefijo "${so.prefijo}" está reservado por la plataforma.`)
    if (e.sujetos.filter((s) => s.prefijo === '').length !== 1)
      throw new ErrorUsuario(
        'Debe haber exactamente un sujeto obligado en la raíz (el Ayuntamiento, sin prefijo).',
      )
    const id = await conUsuario({ ...ctx, origen: 'generador' }, async (tx) => {
      const estado = await tx.query.estados.findFirst({ where: eq(estados.clave, e.estadoClave) })
      if (!estado) throw new ErrorUsuario('No existe ese estado.')
      if (await tx.query.municipios.findFirst({ where: eq(municipios.slug, e.slug) }))
        throw new ErrorUsuario('Ya existe un municipio con ese identificador.')
      const orgId = `org_${e.slug}`
      await tx
        .insert(organization)
        .values({ id: orgId, name: e.nombre, slug: e.slug, createdAt: new Date() })
      const [m] = await tx
        .insert(municipios)
        .values({
          estadoId: estado.id,
          organizationId: orgId,
          slug: e.slug,
          nombre: e.nombre,
          nombreOficial: e.nombreOficial,
          urlRevalidacion: e.urlRevalidacion || `https://${e.dominio}/api/revalidar`,
        })
        .returning()
      await tx
        .insert(municipioDominios)
        .values({ municipioId: m!.id, host: e.dominio, principal: true })
      await tx.insert(municipioTema).values({
        municipioId: m!.id,
        colorPrimario: e.colorPrimario,
        colorSecundario: e.colorSecundario,
        colorAcento: e.colorAcento,
      })
      for (const [i, so] of e.sujetos.entries()) {
        const tipo = await tx.query.tiposSujetoObligado.findFirst({
          where: eq(tiposSujetoObligado.slug, so.tipoSlug),
        })
        if (!tipo) throw new ErrorUsuario(`No existe el tipo de sujeto obligado "${so.tipoSlug}".`)
        await tx.insert(sujetosObligados).values({
          municipioId: m!.id,
          tipoSujetoId: tipo.id,
          nombre: so.nombre,
          prefijo: so.prefijo,
          orden: i,
        })
      }
      return m!.id
    })
    revalidatePath('/admin')
    return { id, slug: e.slug }
  })
}

/** Archivos de índice disponibles en el repo (packages/indice/datos/<carpeta>/<tipo>.json). */
export async function listarArchivosIndice() {
  return accion(async () => {
    await superadmin()
    const requerir = createRequire(import.meta.url)
    const base = requerir
      .resolve('@plataforma/indice/package.json')
      .replace(/package\.json$/, 'datos')
    const carpetas = await readdir(base, { withFileTypes: true })
    const salida: { carpeta: string; archivos: string[] }[] = []
    for (const c of carpetas.filter((d) => d.isDirectory())) {
      const archivos = (await readdir(`${base}/${c.name}`)).filter((a) => a.endsWith('.json'))
      salida.push({ carpeta: c.name, archivos })
    }
    return salida
  })
}

export async function cargarIndiceDesdeRepo(carpeta: string, archivo: string) {
  return accion(async () => {
    const { ctx } = await superadmin()
    const c = z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .parse(carpeta)
    const a = z
      .string()
      .regex(/^[a-z0-9-]+\.json$/)
      .parse(archivo)
    const requerir = createRequire(import.meta.url)
    const base = requerir
      .resolve('@plataforma/indice/package.json')
      .replace(/package\.json$/, 'datos')
    const json = JSON.parse(await readFile(`${base}/${c}/${a}`, 'utf8')) as unknown
    const r = await conUsuario({ ...ctx, origen: 'generador' }, (tx) => cargarIndice(tx, json))
    revalidatePath('/admin/indice')
    return r
  })
}

export async function publicarVersionIndice(versionId: string) {
  return accion(async () => {
    const { ctx } = await superadmin()
    await conUsuario(ctx, (tx) => publicarVersion(tx, z.string().uuid().parse(versionId)))
    revalidatePath('/admin/indice')
  })
}

export async function listarVersiones() {
  const { ctx } = await superadmin()
  return conUsuario(ctx, async (tx) =>
    tx.query.indiceVersiones.findMany({
      with: { estado: true, nodos: { columns: { id: true, tipoSujetoId: true } } },
      orderBy: (v, { desc }) => [desc(v.creadaEn)],
    }),
  )
}

export async function asignarSupervisor(email: string, municipioIds: string[]) {
  return accion(async () => {
    const { ctx } = await superadmin()
    const correo = z.string().email().parse(email.trim().toLowerCase())
    const ids = z.array(z.string().uuid()).parse(municipioIds)
    await conUsuario(ctx, async (tx) => {
      const u = await tx.query.user.findFirst({ where: eq(tablaUser.email, correo) })
      if (!u)
        throw new ErrorUsuario(
          'No existe un usuario con ese correo. Primero debe aceptar una invitación en algún municipio (o crea su cuenta invitándolo).',
        )
      const todos = await tx.query.municipios.findMany({
        columns: { id: true, organizationId: true },
      })
      for (const m of todos) {
        const existe = await tx.query.member.findFirst({
          where: and(eq(member.userId, u.id), eq(member.organizationId, m.organizationId)),
        })
        if (ids.includes(m.id)) {
          if (!existe)
            await tx.insert(member).values({
              id: `mem_${u.id.slice(0, 8)}_${m.id.slice(0, 8)}`,
              organizationId: m.organizationId,
              userId: u.id,
              role: 'supervisor',
              createdAt: new Date(),
            })
          else if (existe.role !== 'supervisor')
            await tx.update(member).set({ role: 'supervisor' }).where(eq(member.id, existe.id))
        } else if (existe?.role === 'supervisor') {
          await tx.delete(member).where(eq(member.id, existe.id))
        }
      }
    })
    revalidatePath('/admin/supervisores')
  })
}

export async function listarSupervisores() {
  const { ctx } = await superadmin()
  return conUsuario(ctx, async (tx) => {
    const filas = await tx
      .select({
        userId: tablaUser.id,
        nombre: tablaUser.name,
        email: tablaUser.email,
        municipioId: municipios.id,
        municipio: municipios.nombre,
      })
      .from(member)
      .innerJoin(tablaUser, eq(tablaUser.id, member.userId))
      .innerJoin(municipios, eq(municipios.organizationId, member.organizationId))
      .where(eq(member.role, 'supervisor'))
    const porUsuario = new Map<
      string,
      { nombre: string; email: string; municipios: { id: string; nombre: string }[] }
    >()
    for (const f of filas) {
      const e = porUsuario.get(f.userId) ?? { nombre: f.nombre, email: f.email, municipios: [] }
      e.municipios.push({ id: f.municipioId, nombre: f.municipio })
      porUsuario.set(f.userId, e)
    }
    return [...porUsuario.values()]
  })
}

export async function alternarPanelMunicipio(municipioId: string, suspender: boolean) {
  return accion(async () => {
    const { ctx } = await superadmin()
    await conUsuario(ctx, (tx) =>
      tx
        .update(municipios)
        .set({ estatus: suspender ? 'panel_suspendido' : 'activo' })
        .where(eq(municipios.id, z.string().uuid().parse(municipioId))),
    )
    revalidatePath('/admin')
  })
}

export const _tipos = async () => {
  const { ctx } = await superadmin()
  return conUsuario(ctx, (tx) => tx.query.tiposSujetoObligado.findMany())
}
void indiceVersiones
