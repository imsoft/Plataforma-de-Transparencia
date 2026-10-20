# Entregables 3 y 4 — Estructura del monorepo y diseño de rutas

## 3. Monorepo

```
plataforma-transparencia/
├── package.json            packageManager pnpm@12.14.0 · engines node 24 · preinstall only-allow pnpm
├── pnpm-workspace.yaml     apps/* · packages/* · templates/*
├── turbo.json              build/dev/lint/test/typecheck con caché; `globalEnv` documentado
├── docker-compose.yml      postgres:18 · minio + minio-init (crea bucket) · mailpit
├── .env.example
├── CLAUDE.md · README.md
├── scripts/
│   ├── setup.ts            docker up → migrar → seed índice → seed municipio demo y usuarios
│   ├── nuevo-municipio.ts  generador (entregable 5)
│   └── migrar-tuxcacuesco/ parser HTML, copia Spaces→R2, reporte
├── apps/
│   ├── panel/              Next.js. Única app con login y escritura
│   └── sitio-tuxcacuesco/  Next.js. Solo lectura. MUNICIPALITY_SLUG=tuxcacuesco
├── packages/
│   ├── config/             tsconfig base, eslint flat config, tailwind preset, prettier
│   ├── db/                 schema/ (auth.ts generado, *.ts propios) · migrations/ (drizzle + sql de roles, RLS, triggers, vistas)
│   │                       cliente (postgres|neon) · withUser / asPublic · consultas/ (lecturas tipadas reutilizables)
│   ├── auth/               instancia Better Auth (server) · cliente · roles y `createAccessControl`
│   │                       permisos.ts: puede(ctx, accion, recurso) + alcances · correos (plantillas React Email → Resend/SMTP)
│   ├── archivos/           cliente S3 · rutaDeArchivo() (7.5) · firmar PUT / multipart · mover() · detectarTipo() (file-type)
│   │                       catálogo de tipos permitidos, límites, íconos (fuente única para 5.8)
│   ├── indice/             formato JSON + zod · claves.ts (generar/normalizar/validar) · semaforo.ts · cargar.ts (seed)
│   │                       datos/jalisco/ley-anterior/{ayuntamiento,dif}.json
│   ├── transparencia/      next/ (páginas, generateMetadata, sitemap, robots, /d, /og, /api/revalidate)
│   │                       resolver.ts (segmentos → sujeto obligado + nodo) · componentes/ · etiquetas-cache.ts · bots.ts
│   ├── ui/                 shadcn compartido (button, dialog, toast, dropzone, etc.) · íconos de archivo
│   ├── ui-sitio/           bloques: encabezado, pie, hero, directorio, noticias, contacto, redes sociales
│   ├── tema/               tokens · temaDesdeBD() · contraste.ts · css.ts (→ variables) · variante oscura
│   └── redes/              catálogo de redes sociales, detección por dominio, generador wa.me  (lo usa panel y sitios)
└── templates/
    └── institucional-clasica/   app Next.js completa con placeholders {{slug}}, {{nombre}}; transparencia ya montada
```

Qué **no** va en una app de municipio: nada de lógica de transparencia, nada de acceso a escritura, nada de auth. Solo `app/(sitio)/...` con sus páginas institucionales, `contenido/` (textos, directorio), `public/` y `tema.config.ts` (fallback si la BD no responde).

Reglas de ESLint entre paquetes: las apps no importan `packages/db` directamente, solo `@platform/transparency` (sitios) o las capas de servicio del panel; `db` crudo solo dentro de `packages/db`.

Vercel: un proyecto por app, mismo repo, `Root Directory` = `apps/<app>`, comando `turbo-ignore` como "Ignored Build Step" para no reconstruir sitios cuando solo cambió el panel.

## 4. Rutas

### 4.1 Sitio público (idénticas en todas las apps de municipio)

| Ruta                                                          | Página                                                                                                                                | Caché            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `/` y páginas institucionales (`/directorio`, `/contacto`...) | propias de la app                                                                                                                     | estática / ISR   |
| `/[prefijo]` ej. `/dif`                                       | portada del sujeto obligado: índice completo en acordeón                                                                              | `so:<prefijo>`   |
| `/transparencia`                                              | portada del Ayuntamiento (raíz tiene la portada del sitio, así que la transparencia del Ayuntamiento vive aquí; `/85a` sigue en raíz) | `so:`            |
| `/articulo-8`, `/dif/articulo-8`                              | artículo completo                                                                                                                     | `nodo:<so>:8`    |
| `/85`, `/dif/85`                                              | fracción                                                                                                                              | `nodo:<so>:85`   |
| `/85a`, `/dif/85a`                                            | inciso (y sub-niveles `/85a1` si existen)                                                                                             | `nodo:<so>:85a`  |
| `/v/ley-anterior/85a`, `/dif/v/ley-anterior/85a`              | mismo nodo en una versión no vigente                                                                                                  | `nodo:…`         |
| `/d/<id>`                                                     | documento: redirección, página de video o HTML para bots                                                                              | `documento:<id>` |
| `/og/nodo/<so>/<clave>-<v>.png`, `/og/d/<id>-<v>.png`         | imágenes de tarjeta                                                                                                                   | immutable        |
| `/sitemap.xml`, `/robots.txt`, `/.well-known/security.txt`    | generados                                                                                                                             | ISR 1 h          |
| `/api/revalidate`                                             | POST protegido, lo llama el panel                                                                                                     | —                |

**Palabras reservadas** (documentadas en `packages/transparency/RESERVADAS.md` y verificadas por una prueba que recorre `app/` de cada sitio): todo lo que empieza con dígito, `d`, `v`, `og`, `api`, `transparencia`, `articulo-*`, `sitemap.xml`, `robots.txt`, `.well-known` y **cada prefijo de sujeto obligado** del municipio. El generador rechaza un prefijo que choque con una página de la plantilla.

### 4.2 Cómo se monta el paquete en una app

```
apps/site-x/app/
├── layout.tsx                     ← envuelve con <ProveedorTema> de @platform/theme
├── page.tsx                       ← portada propia
├── directorio/page.tsx …          ← páginas propias (rutas estáticas; Next les da prioridad)
├── [...segmentos]/page.tsx        ← export { Pagina as default, generateMetadata } from '@platform/transparency/next/page'
├── d/[id]/route.ts                ← export { GET } from '@platform/transparency/next/document'
├── og/[...ruta]/route.tsx         ← export { GET } from '@platform/transparency/next/og'
├── api/revalidate/route.ts         ← export { POST } from '@platform/transparency/next/revalidate'
├── sitemap.ts · robots.ts         ← re-export
└── not-found.tsx                  ← re-export (404 útil con sugerencia de clave)
```

El paquete lee `process.env.MUNICIPALITY_SLUG` una sola vez (`configSitio()`), con validación zod al arrancar. La plantilla ya trae estos archivos, así que montar = no hacer nada.

### 4.3 Resolución de `[...segmentos]` (`resolver.ts`, función pura con pruebas)

```
entrada: ['dif', 'v', 'ley-anterior', '8.5A']
1. version   := si segmentos[i]=='v' → toma el siguiente como slug de versión; si no, la vigente
2. sujeto    := si segmentos[0] coincide con un prefijo del municipio → ese SO, consume 1; si no → Ayuntamiento (prefijo '')
3. resto     := un solo segmento restante, si hay más → 404
4. si resto == 'transparencia' (solo raíz) → portada SO · si vacío y prefijo ≠ '' → portada SO
5. si resto ~ /^articulo-(\d+)$/ → artículo N
6. clave     := normalizar(resto): minúsculas, quitar '.', '-', '_', espacios; romanos → arábigos
               por posición ('8.V.a' → '85a'); 'art8frac5inca' no se soporta (404 con sugerencia)
7. si normalizar(resto) ≠ resto → 301 a la canónica (misma versión y prefijo)
8. buscar nodo por (version, tipo_sujeto del SO, clave) → página; si no existe → 404 con sugerencias
   (claves a distancia de edición 1 dentro del mismo artículo)
```

La clave **no se parsea** en artículo/fracción/inciso: se busca tal cual en `indice_nodos`. Por eso `151b` no es ambiguo en runtime; la unicidad la garantiza la carga del índice.

### 4.4 `/d/<id>`

```
1. doc := publico.documentos(id)   (incluye estado y versión vigente)
2. no existe                 → 404 propio ("Este enlace no corresponde a ningún documento")
3. estado = papelera         → 410 + página "Este documento fue retirado por el municipio" (noindex, con enlace al inciso)
4. estado = oculto/historico → 200 página "Este documento es histórico / ya no está vigente" con enlace al inciso y botón
                               "Ver de todos modos" solo si es histórico (noindex)
5. publicado:
   a. user-agent ∈ bots de vista previa → 200 HTML ligero con OG (entregable 10)
   b. tipo = video o video_externo    → 200 página con reproductor
   c. resto                            → 302 a la URL del archivo (dominio de archivos), con cache-control corto
```

302 y no 301: el destino cambia al reemplazar archivo y no queremos que el navegador cachee la ruta vieja.

### 4.5 Panel (`apps/panel`)

| Ruta                                                                                    | Quién                          | Qué                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------- |
| `/iniciar-sesion`, `/verificar` (2FA), `/invitacion/[token]`, `/recuperar`              | todos                          | auth                                                           |
| `/municipios`                                                                           | con > 1 membresía o superadmin | selector; con 1 sola, redirige                                 |
| `/m/[slug]`                                                                             | municipio                      | inicio: buscador, Recientes, Lo que te falta subir             |
| `/m/[slug]/[prefijo]` (`ayuntamiento`, `dif`)                                           |                                | árbol del sujeto obligado                                      |
| `/m/[slug]/[prefijo]/[clave]`                                                           |                                | nodo: documentos, subir, leyenda                               |
| `/m/[slug]/documentos/[id]`                                                             |                                | detalle: historial, versiones, reemplazar                      |
| `/m/[slug]/papelera`                                                                    |                                | restaurar                                                      |
| `/m/[slug]/usuarios`                                                                    | admin municipal                | invitar, roles, alcance, baja                                  |
| `/m/[slug]/redes-sociales`, `/m/[slug]/identidad`                                       | admin municipal / superadmin   | configuración                                                  |
| `/m/[slug]/bitacora`                                                                    | admin municipal, supervisor    | Fase 2 con filtros; MVP solo por documento                     |
| `/supervisor`                                                                           | supervisor                     | tablero multi-municipio (Fase 2; MVP: lista de sus municipios) |
| `/admin/municipios`, `/admin/municipios/[slug]`, `/admin/indice`, `/admin/supervisores` | superadmin                     | alta y configuración                                           |
| `/api/auth/[...all]`                                                                    |                                | Better Auth                                                    |
| `/api/archivos/firmar`, `/api/archivos/multipart/{iniciar,parte,completar,abortar}`     | autenticado + permiso          | URLs firmadas                                                  |
| `/api/cron/revalidaciones`, `/api/cron/exportaciones`                                   | Vercel Cron con secreto        | reintentos y trabajos en segundo plano                         |

Todas las escrituras son **Server Actions** (zod + `can()` + `withUser`). El panel entero lleva `noindex` y `robots.txt` con `Disallow: /`.

En el panel las URLs usan el prefijo "humano" del sujeto obligado (`ayuntamiento` para la raíz) para no tener rutas vacías; en el sitio público la raíz sigue siendo el Ayuntamiento.
