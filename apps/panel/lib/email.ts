import 'server-only'
import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { env } from './env'

export type Email = { to: string; emailSubject: string; html: string; text: string }

/** Mailpit (SMTP) en local, Resend en producción. Se elige por variable de entorno. */
export async function sendEmail(c: Email): Promise<void> {
  if (env.EMAIL_PROVIDER === 'resend') {
    if (!env.RESEND_API_KEY) throw new Error('Falta RESEND_API_KEY')
    const resend = new Resend(env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: c.to,
      subject: c.emailSubject,
      html: c.html,
      text: c.text,
    })
    if (error) throw new Error(`Resend: ${error.message}`)
    return
  }
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
  })
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: c.to,
    subject: c.emailSubject,
    html: c.html,
    text: c.text,
  })
}
