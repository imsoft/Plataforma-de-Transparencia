# Plataforma de Transparencia Municipal — convenciones

Lee `docs/brief-plataforma-transparencia.md` (requisitos) y `docs/plan/` (decisiones aprobadas) antes de cambiar arquitectura.

## Reglas duras

- **Solo pnpm** (`pnpm`, `pnpm dlx`, `pnpm --filter`). Nunca npm/yarn/bun. Versiones centralizadas en el `catalog:` de `pnpm-workspace.yaml`.
- **Todo el código en inglés**: archivos, carpetas, identificadores, nombres de paquetes (`@platform/*`), tablas, columnas, valores de enum, variables de entorno, claves del JSON del índice y scripts de pnpm. **En español** se quedan: textos de UI, URLs públicas y del panel (`/iniciar-sesion`, `/m/<slug>/papelera`, `/85a`), comentarios, carpetas del bucket (`_versiones/`, `_tema/`), nombres de archivo generados para ciudadanos y la documentación. Los valores de enum se traducen a etiquetas en español en la UI.
- **Toda escritura a la base de datos pasa por `withUser()`** (`@platform/db`). Los triggers rechazan escrituras sin usuario. El cliente crudo (`@platform/db/client`) no se importa desde apps.
- **Toda Server Action**: validar con zod → `require(session, action, target)` (`@platform/auth/permissions`) → `withUser(dbContext(session), tx => …)`.
- **La bitácora (`audit_log`) la llenan triggers de Postgres**, nunca la app. No tiene UPDATE/DELETE para nadie.
- **Nada se borra**: documentos a `trash` (papelera), archivos se quedan en el bucket, versiones anteriores a `_versiones/`.
- **Migraciones**: `pnpm db:generate` para cambios de esquema Drizzle; `pnpm --filter @platform/db generate:custom --name <x>` para SQL a mano (triggers, RLS, grants). Nunca cambios manuales en Neon.
- **El esquema de Better Auth** (`packages/db/src/schema/auth.ts`) se regenera con `pnpm --filter @platform/auth generate:schema`; no se edita a mano.
- **Idioma de la UI**: español de México, sin jerga técnica ("Subir documento", "Copiar enlace", "Mandar a la papelera").
- **Zona horaria**: guardar UTC, mostrar America/Mexico_City. **Ids**: uuid v7 interno, nanoid(12) para `/d/<id>`.
- **Pruebas son parte del entregable.** Vitest contra el Postgres de Docker (`pnpm docker:up`), Playwright para flujos.
- **TypeScript 6.x** (no 7 hasta que typescript-eslint lo soporte), `strict`, ESM, Node 24.
- Commits directos a `main`. Código listo sin explicar lo evidente.

## Mapa

| Ruta                              | Qué es                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/db`                     | esquema Drizzle, migraciones, `withUser`/`asPublic`/`asSystem`, utilidades de prueba |
| `packages/auth`                   | Better Auth (organization + 2FA + admin), roles, capa de permisos `can()/require()`  |
| `packages/law-index`              | formato JSON del índice de la ley, claves cortas, validación, carga, semáforo        |
| `packages/files`                  | S3 (RustFS local / R2), rutas de archivos, URLs firmadas, detección de tipo          |
| `packages/transparency`           | rutas y páginas públicas que montan los sitios (`/85a`, `/dif/85a`, `/d/<id>`)       |
| `packages/theme`, `ui`, `ui-site` | tokens de diseño y componentes                                                       |
| `packages/social-networks`        | catálogo de redes sociales y validación de enlaces                                   |
| `apps/panel`                      | administración central (único con login/escritura)                                   |
| `apps/site-<municipio>`           | sitio público de cada municipio (solo lectura, `MUNICIPALITY_SLUG`)                  |
| `templates/`                      | plantillas base para `pnpm new-municipality`                                         |
| `scripts/`                        | `bootstrap.ts` (semilla local), generador, migración de Tuxcacuesco                  |

## Comandos

```
pnpm bootstrap             # Docker + migraciones + índice de prueba + municipio demo + usuarios (2FA sembrada)
pnpm dev                   # apps en local (panel :3000, site-tuxcacuesco :3001)
pnpm test                  # Vitest en todos los paquetes (requiere Docker arriba) · pnpm test:scripts
pnpm e2e                   # Playwright (desktop, tablet, mobile); levanta las apps si no corren
pnpm typecheck · pnpm lint · pnpm format
pnpm docker:reset          # borra volúmenes y vuelve a levantar
pnpm new-municipality      # genera apps/site-<slug> desde templates/ y registra el municipio
pnpm migrate:tuxcacuesco   # reporte + índice v1; --verify (HEAD) · --migrate (copia archivos y crea documentos)
```

## Decisiones que no se ven en el código

- `pnpm setup` es un comando interno de pnpm: por eso el script se llama `bootstrap`.
- Roles de Postgres: `migrator` (dueño, migraciones y scripts), `app_panel` (panel, con RLS), `public_reader` (sitios, solo lectura). Variables de sesión que leen triggers y RLS: `app.user_id`, `app.role`, `app.allowed_municipalities`, `app.municipality_id`, `app.municipality_slug`, `app.origin`.
- Roles de la app: `superadmin` (global), `supervisor`, `municipal_admin`, `uploader` (capturista).
- Los usuarios semilla con rol que exige 2FA ya la tienen configurada con un secreto conocido (solo local); las E2E generan el código TOTP (`e2e/fixtures/totp.ts`).
- Better Auth no cachea la sesión en cookie: dar de baja revoca el acceso en la misma petición.
- El inciso "ñ" se escribe `nn` en la clave (`85nn`) para que la URL sea ASCII.
- **Colores de demo y por defecto neutros** (azul petróleo `#125c6a`, pizarra `#35505e`, azul grisáceo `#5b7a8c`): nunca guinda, rojo/verde PRI, azul PAN, naranja MC, verde PVEM ni amarillo PRD en material de venta o en la plataforma. Cada municipio elige los suyos en su panel.
- Prettier no toca `docs/brief-plataforma-transparencia.md` (es el documento del cliente).
- La CSP la pone `proxy.ts` con nonce (`packages/config/csp.ts`); cualquier script inline nuevo debe llevar `nonce` (se lee de la cabecera `x-nonce`). No volver a poner CSP en `next.config`.
- Las llamadas paralelas de herramientas comparten el directorio de trabajo: usa rutas absolutas en scripts de automatización.
