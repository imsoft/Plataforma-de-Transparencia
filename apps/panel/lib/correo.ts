import 'server-only'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { env } from './env'

export type Correo = { para: string; asunto: string; html: string; texto: string }

/** Mailpit (SMTP) en local, Resend en producción. Se elige por variable de entorno. */
export async function enviarCorreo(c: Correo): Promise<void> {
  if (env.CORREO_PROVEEDOR === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY')
    const resend = new Resend(env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: env.CORREO_REMITENTE,
      to: c.para,
      subject: c.asunto,
      html: c.html,
      text: c.texto,
    })
    if (error) throw new Error(`Resend: ${error.message}`)
    return
  }
  const transporte = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  })
  await transporte.sendMail({
    from: env.CORREO_REMITENTE,
    to: c.para,
    subject: c.asunto,
    html: c.html,
    text: c.texto,
  })
}
