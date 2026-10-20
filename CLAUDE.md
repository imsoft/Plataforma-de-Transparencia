# Plataforma de Transparencia Municipal — convenciones

Lee `docs/brief-plataforma-transparencia.md` (requisitos) y `docs/plan/` (decisiones aprobadas) antes de cambiar arquitectura.

## Reglas duras

- **Solo pnpm** (`pnpm`, `pnpm dlx`, `pnpm --filter`). Nunca npm/yarn/bun. Versiones centralizadas en el `catalog:` de `pnpm-workspace.yaml`.
- **Toda escritura a la base de datos pasa por `conUsuario()`** (`@plataforma/db`). Los triggers rechazan escrituras sin usuario. El cliente crudo (`@plataforma/db/cliente`) no se importa desde apps.
- **Toda Server Action**: validar con zod → `exigir(sesion, accion, objetivo)` (`@plataforma/auth/permisos`) → `conUsuario(contextoDb(sesion), tx => …)`.
- **La bitácora la llenan triggers de Postgres**, nunca la app. No tiene UPDATE/DELETE para nadie.
- **Nada se borra**: documentos a `papelera`, archivos se quedan en el bucket, versiones anteriores a `_versiones/`.
- **Migraciones**: `pnpm db:generate` para cambios de esquema Drizzle; `pnpm --filter @plataforma/db generate:custom --name <x>` para SQL a mano (triggers, RLS, grants). Nunca cambios manuales en Neon.
- **El esquema de Better Auth** (`packages/db/src/schema/auth.ts`) se regenera con `pnpm --filter @plataforma/auth generate:schema`; no se edita a mano.
- **Idioma**: UI, comentarios y nombres de dominio en español de México, sin jerga técnica en la UI ("Subir documento", "Copiar enlace", "Mandar a la papelera").
- **Zona horaria**: guardar UTC, mostrar America/Mexico_City. **Ids**: uuid v7 interno, nanoid(12) para `/d/<id>`.
- **Pruebas son parte del entregable.** Vitest contra el Postgres de Docker (`pnpm docker:up`), Playwright para flujos.
- **TypeScript 6.x** (no 7 hasta que typescript-eslint lo soporte), `strict`, ESM, Node 24.
- Commits directos a `main`. Código listo sin explicar lo evidente.

## Mapa

| Ruta                              | Qué es                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/db`                     | esquema Drizzle, migraciones, `conUsuario`/`comoPublico`/`comoSistema`, utilidades de prueba |
| `packages/auth`                   | Better Auth (organization + 2FA + admin), roles, capa de permisos `puede()/exigir()`         |
| `packages/indice`                 | formato JSON del índice de la ley, claves cortas, validación, carga, semáforo                |
| `packages/archivos`               | S3 (RustFS local / R2), rutas de archivos, URLs firmadas, detección de tipo                  |
| `packages/transparencia`          | rutas y páginas públicas que montan los sitios (`/85a`, `/dif/85a`, `/d/<id>`)               |
| `packages/tema`, `ui`, `ui-sitio` | tokens de diseño y componentes                                                               |
| `apps/panel`                      | administración central (único con login/escritura)                                           |
| `apps/sitio-<municipio>`          | sitio público de cada municipio (solo lectura, `MUNICIPIO_SLUG`)                             |
| `templates/`                      | plantillas base para `pnpm nuevo-municipio`                                                  |
| `scripts/`                        | `setup.ts` (semilla local), generador, migración de Tuxcacuesco                              |

## Comandos

```
pnpm iniciar               # Docker + migraciones + índice de prueba + municipio demo + usuarios (2FA sembrada)
pnpm dev                   # apps en local (panel :3000, sitio-tuxcacuesco :3001)
pnpm test                  # Vitest en todos los paquetes (requiere Docker arriba) · pnpm test:scripts
pnpm e2e                   # Playwright (escritorio, tablet, celular); levanta las apps si no corren
pnpm typecheck · pnpm lint · pnpm format
pnpm docker:reset          # borra volúmenes y vuelve a levantar
pnpm nuevo-municipio       # genera apps/sitio-<slug> desde templates/ y registra el municipio
pnpm migrar:tuxcacuesco    # reporte + índice v1; --verificar (HEAD) · --migrar (copia archivos y crea documentos)
```

## Decisiones que no se ven en el código

- `pnpm setup` es un comando interno de pnpm: por eso el script se llama `iniciar`.
- Los usuarios semilla con rol que exige 2FA ya la tienen configurada con un secreto conocido (solo local); las E2E generan el código TOTP (`e2e/recursos/totp.ts`).
- Better Auth no cachea la sesión en cookie: dar de baja revoca el acceso en la misma petición.
- El inciso "ñ" se escribe `nn` en la clave (`85nn`) para que la URL sea ASCII.
- **Colores de demo y por defecto neutros** (azul petróleo `#125c6a`, pizarra `#35505e`, azul grisáceo `#5b7a8c`): nunca guinda, rojo/verde PRI, azul PAN, naranja MC, verde PVEM ni amarillo PRD en material de venta o en la plataforma. Cada municipio elige los suyos en su panel.
- Prettier no toca `docs/brief-plataforma-transparencia.md` (es el documento del cliente).
- La CSP la pone `proxy.ts` con nonce (`packages/config/csp.ts`); cualquier script inline nuevo debe llevar `nonce` (se lee de la cabecera `x-nonce`). No volver a poner CSP en `next.config`.
- Las llamadas paralelas de herramientas comparten el directorio de trabajo: usa rutas absolutas en scripts de automatización.
