import 'server-only'
import {
  and,
  auditLog,
  withUser,
  settings,
  eq,
  gte,
  inArray,
  sql,
  user as userTable,
  type UserContext,
} from '@platform/db'
import { sendEmail } from './email'
import { env } from './env'

export type AlertThresholds = { windowMinutes: number; maxDeletions: number }
export const DEFAULT_THRESHOLDS: AlertThresholds = { windowMinutes: 10, maxDeletions: 20 }

const SENSITIVE_ACTIONS = ['trash', 'replace', 'delete', 'hide', 'historical', 'dar_de_baja']

/**
 * Detecta comportamiento anómalo en la bitácora (muchas eliminaciones o reemplazos en poco tiempo, por actor)
 * y avisa a los superadministradores. Evita repetir el mismo aviso guardando la última alerta por actor.
 */
export async function checkAlerts(ctx: UserContext): Promise<{ alerts: number }> {
  return withUser(ctx, async (tx) => {
    const cfg = await tx.query.settings.findFirst({
      where: eq(settings.key, 'alertas.umbrales'),
    })
    const thresholds = {
      ...DEFAULT_THRESHOLDS,
      ...((cfg?.value as Partial<AlertThresholds> | undefined) ?? {}),
    }
    const from = new Date(Date.now() - thresholds.windowMinutes * 60_000)
    const suspicious = await tx
      .select({
        actorId: auditLog.actorId,
        municipalityId: auditLog.municipalityId,
        n: sql<number>`count(*)::int`,
      })
      .from(auditLog)
      .where(and(gte(auditLog.occurredAt, from), inArray(auditLog.action, SENSITIVE_ACTIONS)))
      .groupBy(auditLog.actorId, auditLog.municipalityId)
    const severe = suspicious.filter(
      (s) => s.n >= thresholds.maxDeletions && !s.actorId.startsWith('sistema:'),
    )
    if (severe.length === 0) return { alerts: 0 }

    const previousAlerts = await tx.query.settings.findFirst({
      where: eq(settings.key, 'alertas.enviadas'),
    })
    const sent = (previousAlerts?.value as Record<string, string> | undefined) ?? {}
    const newOnes: typeof severe = []
    for (const g of severe) {
      const key = `${g.actorId}:${g.municipalityId ?? '-'}`
      const last = sent[key] ? new Date(sent[key]) : null
      if (last && Date.now() - last.getTime() < thresholds.windowMinutes * 60_000 * 3) continue
      sent[key] = new Date().toISOString()
      newOnes.push(g)
    }
    if (newOnes.length === 0) return { alerts: 0 }
    await tx
      .insert(settings)
      .values({ key: 'alertas.enviadas', value: sent })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sent, updatedAt: new Date() },
      })

    const superadmins = await tx.query.user.findMany({
      where: sql`${userTable.role} ILIKE '%superadmin%'`,
      columns: { email: true, name: true },
    })
    const actors = await tx.query.user.findMany({
      where: inArray(
        userTable.id,
        newOnes.map((n) => n.actorId),
      ),
      columns: { id: true, email: true, name: true },
    })
    const lines = newOnes.map((n) => {
      const a = actors.find((x) => x.id === n.actorId)
      return `• ${a ? `${a.name} (${a.email})` : n.actorId}: ${n.n} eliminaciones/reemplazos en ${thresholds.windowMinutes} minutos${n.municipalityId ? ` · municipio ${n.municipalityId}` : ''}`
    })
    for (const s of superadmins) {
      await sendEmail({
        to: s.email,
        emailSubject: `⚠ Actividad inusual en ${env.NEXT_PUBLIC_PLATFORM_NAME}`,
        html: `<p>Se detectó actividad inusual (umbral: ${thresholds.maxDeletions} en ${thresholds.windowMinutes} min):</p><ul>${lines.map((l) => `<li>${l.slice(2)}</li>`).join('')}</ul><p>Revisa la bitácora del municipio. Si es una cuenta robada, dala de baja desde Usuarios: pierde el acceso al instante y nada se ha borrado de verdad (papelera y versiones).</p>`,
        text: `Actividad inusual:\n${lines.join('\n')}\nRevisa la bitácora del municipio.`,
      })
    }
    return { alerts: newOnes.length }
  })
}
