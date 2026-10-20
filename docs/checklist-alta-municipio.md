# Checklist: dar de alta un municipio

1. **Base y app**: `pnpm new-municipality` (o `/admin/municipios/nuevo` en el panel + copiar la plantilla a mano). Anota el `REVALIDATION_SECRET` generado.
2. **Panel**: agrega el secreto a `REVALIDATION_SECRETS` (Vercel → panel → variables) y vuelve a desplegar el panel.
3. **Vercel**: nuevo proyecto con Root Directory `apps/site-<slug>`, variables de `apps/site-<slug>/.env.example` con valores de producción, dominio `<slug>.gob.mx` (+ `www`).
4. **DNS** (cuando controles el dominio): `A/CNAME` a Vercel, DNSSEC activado, registro `CAA 0 issue "letsencrypt.org"`.
5. **Identidad**: en el panel, `/m/<slug>/identidad`: colores, escudo, datos de contacto. Revisa el aviso de contraste.
6. **Redes sociales**: `/m/<slug>/redes-sociales`.
7. **Usuarios**: invita al admin municipal (y que active su 2FA).
8. **Contenido institucional**: edita `apps/site-<slug>/content/site.ts` (menú, directorio, portada).
9. **SEO**: Google Search Console → verificar dominio → enviar `https://<dominio>/sitemap.xml`. Revisar/crear el Perfil de Negocio de Google del ayuntamiento.
10. **Tarjetas**: pega `https://<dominio>/85a` y un `/d/<id>` en un chat de WhatsApp real y en https://developers.facebook.com/tools/debug/ ; deben verse escudo, título y clave.
11. **Prueba de 2 minutos**: una persona del municipio sube su primer documento y copia el enlace sin ayuda. Si no lo logra, anota dónde se atoró.
12. **Monitoreo**: agrega el dominio al monitor de disponibilidad y verifica que Sentry reciba eventos del sitio.
