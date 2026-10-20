import { describe, expect, it } from 'vitest'
import { contextoDb, exigir, puede, rolPermite, type Sesion } from './permisos'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const DIF = 'so-dif'
const AYTO = 'so-ayto'

const sesion = (over: Partial<Sesion> = {}): Sesion => ({
  usuarioId: 'u1',
  esSuperadmin: false,
  membresias: [{ municipioId: A, organizationId: 'org-a', rol: 'capturista', alcances: [] }],
  ...over,
})

describe('roles', () => {
  it('capturista sube pero no invita; admin municipal invita; supervisor sube pero no invita', () => {
    expect(rolPermite('capturista', 'documento:subir')).toBe(true)
    expect(rolPermite('capturista', 'usuario:invitar')).toBe(false)
    expect(rolPermite('admin_municipal', 'usuario:invitar')).toBe(true)
    expect(rolPermite('supervisor', 'documento:subir')).toBe(true)
    expect(rolPermite('supervisor', 'usuario:invitar')).toBe(false)
    expect(rolPermite('supervisor', 'redes_sociales:editar')).toBe(false)
    expect(rolPermite('admin_municipal', 'redes_sociales:editar')).toBe(true)
  })
})

describe('puede', () => {
  it('deniega por defecto: sin membresía en ese municipio no se puede nada', () => {
    expect(puede(sesion(), 'documento:ver', { municipioId: B })).toBe(false)
  })

  it('el superadmin puede todo en todos lados', () => {
    expect(puede(sesion({ esSuperadmin: true }), 'usuario:dar_de_baja', { municipioId: B })).toBe(
      true,
    )
  })

  it('alcance por sujeto obligado: capturista del DIF no sube al Ayuntamiento', () => {
    const s = sesion({
      membresias: [
        {
          municipioId: A,
          organizationId: 'org-a',
          rol: 'capturista',
          alcances: [{ sujetoObligadoId: DIF, nodoId: null }],
        },
      ],
    })
    expect(puede(s, 'documento:subir', { municipioId: A, sujetoObligadoId: DIF })).toBe(true)
    expect(puede(s, 'documento:subir', { municipioId: A, sujetoObligadoId: AYTO })).toBe(false)
  })

  it('alcance por fracción: cubre al nodo y a sus descendientes', () => {
    const s = sesion({
      membresias: [
        {
          municipioId: A,
          organizationId: 'org-a',
          rol: 'capturista',
          alcances: [{ sujetoObligadoId: null, nodoId: 'fr-5' }],
        },
      ],
    })
    expect(
      puede(s, 'documento:subir', {
        municipioId: A,
        sujetoObligadoId: AYTO,
        nodoRuta: ['art-8', 'fr-5', 'inc-a'],
      }),
    ).toBe(true)
    expect(
      puede(s, 'documento:subir', {
        municipioId: A,
        sujetoObligadoId: AYTO,
        nodoRuta: ['art-8', 'fr-6'],
      }),
    ).toBe(false)
    // el alcance no aplica a acciones que no son de documentos/leyendas
    expect(puede(s, 'bitacora:ver', { municipioId: A })).toBe(true)
  })

  it('exigir lanza un error claro', () => {
    expect(() => exigir(sesion(), 'usuario:invitar', { municipioId: A })).toThrow(
      /No tienes permiso/,
    )
  })
})

describe('contextoDb', () => {
  it('traduce la sesión al contexto de conUsuario', () => {
    const ctx = contextoDb(
      sesion({
        membresias: [
          { municipioId: A, organizationId: 'o', rol: 'admin_municipal', alcances: [] },
          { municipioId: B, organizationId: 'o2', rol: 'supervisor', alcances: [] },
        ],
      }),
      B,
    )
    expect(ctx).toEqual({
      usuarioId: 'u1',
      rol: 'supervisor',
      municipiosPermitidos: [A, B],
      origen: 'panel',
    })
    expect(contextoDb(sesion({ esSuperadmin: true })).rol).toBe('superadmin')
  })
})
