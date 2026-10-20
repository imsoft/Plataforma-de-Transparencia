# Pasar a producción

Todo cambia de local a producción **solo con variables de entorno**. Cuentas necesarias: Neon, Cloudflare (R2 + DNS), Vercel Pro, Resend, Sentry. Costo base estimado: 40–45 USD/mes.

## 1. Neon (Postgres 18)

1. Crea el proyecto con Postgres **18** y región `us-east` (la más cercana a Vercel `iad1`).
2. En el SQL Editor crea los roles (contraseñas largas, guárdalas en un gestor):
   ```sql
   CREATE ROLE migrator LOGIN PASSWORD '…' CREATEROLE;
   CREATE ROLE app_panel LOGIN PASSWORD '…';
   CREATE ROLE public_reader LOGIN PASSWORD '…';
   GRANT ALL PRIVILEGES ON DATABASE neondb TO migrator;
   ALTER DATABASE neondb OWNER TO migrator;
   ```
3. Desde tu máquina, con `DATABASE_URL_MIGRATIONS` apuntando a Neon (rol `migrator`, `?sslmode=require`):
   ```bash
   pnpm --filter @platform/db migrate
   ```
4. Activa en Neon la ventana de restauración (PITR) de 7 días (plan Launch) y anota cómo restaurar (ver `docs/restauracion.md`).
5. Variables para Vercel (panel): `DATABASE_DRIVER=neon`, `DATABASE_URL` (rol `app_panel`, **pooled** connection string). Sitios: `DATABASE_URL_PUBLIC` (rol `public_reader`, pooled).

## 2. Cloudflare R2

1. Bucket privado `transparencia-<plataforma>`.
2. Dominio público del bucket: `archivos.<plataforma>.mx` (R2 → Settings → Public access → Custom domain). Cloudflare lo cachea y da TLS.
3. CORS del bucket (R2 → Settings → CORS): orígenes `https://panel.<plataforma>.mx`, métodos `GET, PUT, HEAD`, headers `*`, **expose `ETag`** (sin esto la subida de videos por partes no puede completarse).
4. Token de API **solo** para ese bucket con permisos Object Read & Write. Variables (panel): `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE=false`, `FILES_PUBLIC_URL=https://archivos.<plataforma>.mx`. Los sitios solo necesitan `FILES_PUBLIC_URL`.
5. Regla de caché en Cloudflare para `archivos.*`: cache everything, TTL 1 día; los archivos reemplazados cambian de ruta (`_versiones/`), así que no hay caché vieja.

## 3. Resend

Verifica el dominio de la plataforma (SPF/DKIM) y crea una API key. Variables (panel): `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM="Plataforma de Transparencia <no-responder@<plataforma>.mx>"`.

## 4. Vercel Pro

Un proyecto por app, todos conectados al mismo repo:

| Proyecto           | Root Directory          | Dominio                 | Variables                                                                                                                                                                   |
| ------------------ | ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `panel`            | `apps/panel`            | `panel.<plataforma>.mx` | todas las del panel (`.env.example`) + `BETTER_AUTH_URL=https://panel.<plataforma>.mx`, `BETTER_AUTH_SECRET` (32+ aleatorios), `REVALIDATION_SECRETS` (JSON slug → secreto) |
| `site-tuxcacuesco` | `apps/site-tuxcacuesco` | `tuxcacuesco.gob.mx`    | `MUNICIPALITY_SLUG`, `NEXT_PUBLIC_SITE_URL=https://tuxcacuesco.gob.mx`, `REVALIDATION_SECRET`, `DATABASE_URL_PUBLIC`, `DATABASE_DRIVER=neon`, `FILES_PUBLIC_URL`            |

- Build Command: por defecto (`next build`); Install Command: `pnpm install --frozen-lockfile`; Node 24.
- **Ignored Build Step** en cada proyecto: `npx turbo-ignore` para no reconstruir sitios cuando solo cambió el panel.
- Vercel Firewall: activar reglas gestionadas (OWASP) y _bot protection_ en el panel.
- Crons del panel (`apps/panel/vercel.json`): `/api/cron/revalidaciones` cada 5 min y `/api/cron/alertas` cada 10 min. Vercel los autentica con `CRON_SECRET` (variable del proyecto).

## 5. Sentry

Un proyecto por app (`@sentry/nextjs` ya está en el catálogo; la integración se activa con `SENTRY_DSN`). `beforeSend` quita cabeceras y cuerpos.

## 6. Después del primer deploy

1. Crea el superadmin: acepta una invitación o corre `pnpm bootstrap` apuntando a Neon **no** (crea datos de prueba). Alternativa: usa el panel local con `DATABASE_URL` de Neon una sola vez para dar de alta tu usuario y márcalo `role='superadmin'` por SQL.
2. Activa tu 2FA.
3. Carga y publica el índice `ley-anterior` desde `/admin/indice`.
4. Corre la migración de Tuxcacuesco contra Neon y R2: `pnpm migrate:tuxcacuesco --verify` y luego `--migrate` (ver `scripts/migrate-tuxcacuesco/index.ts`).
5. Sigue `docs/checklist-alta-municipio.md` para el dominio, Search Console y tarjetas.
