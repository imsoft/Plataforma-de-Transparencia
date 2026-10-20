import { describe, expect, it } from 'vitest'
import { dbContext, require, can, roleAllows, type Session } from './permissions'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const DIF = 'so-dif'
const CITY_HALL = 'so-ayto'

const session = (over: Partial<Session> = {}): Session => ({
  userId: 'u1',
  isSuperadmin: false,
  memberships: [{ municipalityId: A, organizationId: 'org-a', role: 'uploader', scopes: [] }],
  ...over,
})

describe('roles', () => {
  it('capturista sube pero no invita; admin municipal invita; supervisor sube pero no invita', () => {
    expect(roleAllows('uploader', 'document:upload')).toBe(true)
    expect(roleAllows('uploader', 'user:invite')).toBe(false)
    expect(roleAllows('municipal_admin', 'user:invite')).toBe(true)
    expect(roleAllows('supervisor', 'document:upload')).toBe(true)
    expect(roleAllows('supervisor', 'user:invite')).toBe(false)
    expect(roleAllows('supervisor', 'socialNetworks:edit')).toBe(false)
    expect(roleAllows('municipal_admin', 'socialNetworks:edit')).toBe(true)
  })
})

describe('puede', () => {
  it('deniega por defecto: sin membresía en ese municipio no se puede nada', () => {
    expect(can(session(), 'document:view', { municipalityId: B })).toBe(false)
  })

  it('el superadmin puede todo en todos lados', () => {
    expect(can(session({ isSuperadmin: true }), 'user:remove', { municipalityId: B })).toBe(true)
  })

  it('alcance por sujeto obligado: capturista del DIF no sube al Ayuntamiento', () => {
    const s = session({
      memberships: [
        {
          municipalityId: A,
          organizationId: 'org-a',
          role: 'uploader',
          scopes: [{ obligatedSubjectId: DIF, nodeId: null }],
        },
      ],
    })
    expect(can(s, 'document:upload', { municipalityId: A, obligatedSubjectId: DIF })).toBe(true)
    expect(can(s, 'document:upload', { municipalityId: A, obligatedSubjectId: CITY_HALL })).toBe(
      false,
    )
  })

  it('alcance por fracción: cubre al nodo y a sus descendientes', () => {
    const s = session({
      memberships: [
        {
          municipalityId: A,
          organizationId: 'org-a',
          role: 'uploader',
          scopes: [{ obligatedSubjectId: null, nodeId: 'fr-5' }],
        },
      ],
    })
    expect(
      can(s, 'document:upload', {
        municipalityId: A,
        obligatedSubjectId: CITY_HALL,
        nodePath: ['art-8', 'fr-5', 'inc-a'],
      }),
    ).toBe(true)
    expect(
      can(s, 'document:upload', {
        municipalityId: A,
        obligatedSubjectId: CITY_HALL,
        nodePath: ['art-8', 'fr-6'],
      }),
    ).toBe(false)
    // el alcance no aplica a acciones que no son de documentos/leyendas
    expect(can(s, 'auditLog:view', { municipalityId: A })).toBe(true)
  })

  it('exigir lanza un error claro', () => {
    expect(() => require(session(), 'user:invite', { municipalityId: A })).toThrow(
      /No tienes permiso/,
    )
  })
})

describe('dbContext', () => {
  it('traduce la sesión al contexto de withUser', () => {
    const ctx = dbContext(
      session({
        memberships: [
          { municipalityId: A, organizationId: 'o', role: 'municipal_admin', scopes: [] },
          { municipalityId: B, organizationId: 'o2', role: 'supervisor', scopes: [] },
        ],
      }),
      B,
    )
    expect(ctx).toEqual({
      userId: 'u1',
      role: 'supervisor',
      allowedMunicipalities: [A, B],
      origin: 'panel',
    })
    expect(dbContext(session({ isSuperadmin: true })).role).toBe('superadmin')
  })
})
