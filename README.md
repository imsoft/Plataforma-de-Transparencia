# Plataforma de Transparencia Municipal

SaaS multi-municipio: un **panel** central donde cada municipio administra sus documentos de transparencia y **un sitio por municipio** (su dominio, su diseño) que los publica con URLs cortas (`/85a`, `/dif/85a`) y enlaces permanentes (`/d/<id>`).

Monorepo Turborepo + pnpm · Next.js · Drizzle + Postgres (Neon) · Better Auth · S3 (Cloudflare R2; RustFS en local) · Vercel.

## Desarrollo local (sin cuentas en la nube)

Requisitos: Node 24, pnpm 12 (`corepack enable`), Docker Desktop.

```bash
cp .env.example .env     # valores locales ya listos
pnpm install
pnpm iniciar               # Docker (Postgres 18, RustFS como S3, Mailpit) + migraciones + datos semilla
pnpm dev
```

Servicios locales:

| Servicio                  | URL                                        |
| ------------------------- | ------------------------------------------ |
| Panel                     | http://localhost:3000                      |
| Sitio Tuxcacuesco (demo)  | http://localhost:3001                      |
| Mailpit (correos)         | http://localhost:8025                      |
| Consola S3 local (RustFS) | http://localhost:9001 (minio / minio12345) |
| Postgres                  | `localhost:5432`, base `transparencia`     |

Usuarios de prueba: los imprime `pnpm iniciar` (uno por rol).

Pruebas: `pnpm test` (unitarias e integración, necesita Docker arriba), `pnpm e2e` (Playwright en escritorio, tablet y celular). Reiniciar todo: `pnpm docker:reset && pnpm iniciar`.

Más documentación:

- `docs/produccion.md` — cuentas, roles de Postgres, variables y despliegue en Vercel.
- `docs/checklist-alta-municipio.md` — pasos para dar de alta un municipio nuevo (DNS, Search Console, tarjetas).
- `docs/restauracion.md` — respaldos y cómo restaurar base y archivos.
- `docs/owasp-checklist.md` — estado de seguridad antes del lanzamiento.
- `docs/plan/` — plan aprobado (fases, esquema, rutas, wireframes, riesgos).

## Producción (resumen; detalle en `docs/produccion.md`)

1. **Neon**: proyecto Postgres 18. Crear roles `app_panel` y `lector_publico` (login, contraseña) y uno `migraciones` dueño de la base. Correr `pnpm db:migrate` con `DATABASE_URL_MIGRACIONES` apuntando a Neon.
2. **Cloudflare R2**: bucket privado + dominio público `archivos.<plataforma>.mx` + token de API limitado al bucket. Variables `S3_*`.
3. **Resend**: dominio verificado, `RESEND_API_KEY`, `CORREO_PROVEEDOR=resend`.
4. **Vercel Pro**: un proyecto por app con _Root Directory_ `apps/<app>`; variables de entorno por proyecto; `DATABASE_DRIVER=neon`.
5. **Sentry**: un proyecto por app.

Todo cambia de local a producción solo con variables de entorno (`.env.example` las documenta).

## Estructura

Ver `CLAUDE.md` (mapa de paquetes y convenciones) y `docs/plan/` (plan aprobado).
