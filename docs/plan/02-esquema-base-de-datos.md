# Entregable 2 — Esquema de base de datos

Postgres 18 · Drizzle ORM · nombres en español, `snake_case`. Todas las fechas en `timestamptz` (UTC). IDs: `uuid` v7 para tablas internas; `text` nanoid de 12 caracteres para `documentos` porque va en `/d/<id>` y debe ser corto y no adivinable.

## 1. Roles de Postgres

| Rol              | Usa                                                           | Permisos                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `migraciones`    | drizzle-kit, `pnpm setup`, script de migración de Tuxcacuesco | Dueño de todas las tablas. Único que puede crear/alterar                                                                                                                                                     |
| `app_panel`      | `apps/panel`                                                  | `SELECT/INSERT/UPDATE` en tablas de negocio; `INSERT` en `bitacora`; **nunca** `DELETE` salvo en `revalidaciones_pendientes` y tablas de Better Auth (`session`, `verification`, `invitation`); sujeto a RLS |
| `lector_publico` | todas las `apps/sitio-*`                                      | Solo `SELECT` sobre un conjunto de **vistas** `publico.*`; sujeto a RLS                                                                                                                                      |

`bitacora`: `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC, app_panel, lector_publico` + trigger que rechaza. Ni el superadmin de la plataforma (que es un usuario de la app, no un rol de Postgres) puede tocarla.

## 2. Tablas de Better Auth (las crea su CLI, no se modifican a mano)

`user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `twoFactor`. Las generamos con `pnpm dlx @better-auth/cli generate` hacia `packages/db/src/schema/auth.ts` y las migramos con drizzle-kit como todo lo demás.

Integración:

- `user.role` (plugin admin): `'superadmin'` o `'usuario'`. Campo adicional `user.cargo` (puesto en el municipio) y `user.telefono` (opcional).
- `organization` ↔ `municipios`: **1:1**. `municipios.organization_id` es FK única hacia `organization.id`. El `slug` de la organización = `municipios.slug`.
- `member.role`: `'admin_municipal' | 'capturista' | 'supervisor'`. Definidos con `createAccessControl` del plugin de organizaciones (roles estáticos, no dinámicos).
- **Supervisor = membresía con rol `supervisor` en cada municipio asignado.** El superadmin lo asigna; "todos los municipios" es un botón que crea todas las membresías. Evita un rol global aparte y aprovecha RLS sin casos especiales.
- `invitation`: la usa Better Auth para invitar por correo (Resend/Mailpit). `inviterId` nos sirve de actor en la bitácora.
- `session.activeOrganizationId`: municipio activo (el selector).

## 3. Tablas propias

### Catálogo de la ley

```
estados                 id, clave ('JAL'), nombre
tipos_sujeto_obligado   id, slug ('ayuntamiento'|'dif'|'agua'...), nombre
indice_versiones        id, estado_id→estados, slug ('ley-anterior'), nombre, fecha_vigencia date,
                        estatus enum('borrador','vigente','historica'), carpeta_r2 ('ley-anterior'),
                        publicada_en, creada_en
                        UNIQUE(estado_id, slug) · solo UNA 'vigente' por estado (índice parcial único)
indice_nodos            id, version_id→indice_versiones, tipo_sujeto_id→tipos_sujeto_obligado,
                        padre_id→indice_nodos (null = raíz), nivel enum('articulo','fraccion','inciso','subinciso'),
                        numero text ('8','5','a'), etiqueta text ('Art. 8','Fracc. V','Inciso a'),
                        titulo text (texto oficial), descripcion text, clave text ('85a' · null en raíz),
                        ruta_slug text (solo para secciones sin numeración legal, ver riesgos),
                        periodicidad enum('mensual','trimestral','semestral','anual','permanente'),
                        carpeta_r2 text ('art-08/fr-05/inc-a'), orden int, activo bool
                        UNIQUE(version_id, tipo_sujeto_id, clave) · INDEX(padre_id, orden)
indice_equivalencias    id, nodo_origen_id, nodo_destino_id, tipo enum('exacta','parcial'), nota
```

### Municipios

```
municipios              id, estado_id, organization_id→organization UNIQUE, slug UNIQUE, nombre ('Tuxcacuesco'),
                        nombre_oficial ('H. Ayuntamiento de Tuxcacuesco'), estatus enum('activo','panel_suspendido'),
                        url_revalidacion text, secreto_revalidacion text (hash), datos_contacto jsonb
                        (dirección, teléfono, correo, horario → JSON-LD), creado_en, actualizado_en
municipio_dominios      id, municipio_id, host UNIQUE, principal bool
municipio_tema          municipio_id PK, plantilla enum('institucional-clasica','moderna-minimalista','ciudadana-servicios'),
                        color_primario, color_secundario, color_acento (hex), tipografia text,
                        escudo_ruta, logo_administracion_ruta, imagenes jsonb, version int (↑ en cada cambio;
                        va en la URL de las imágenes OG), actualizado_en
sujetos_obligados       id, municipio_id, tipo_sujeto_id, nombre ('DIF Tuxcacuesco'), prefijo text ('' = raíz),
                        orden, activo        UNIQUE(municipio_id, prefijo) · UNIQUE(municipio_id, tipo_sujeto_id)
redes_sociales          id, municipio_id, sujeto_obligado_id (null = todo el municipio), red text (catálogo u 'otra'),
                        nombre_otra text, url, texto, orden, visible bool, ocultar_en_veda bool, actualizado_en
alcances_miembro        id, member_id→member, sujeto_obligado_id (null=todos), nodo_id (null=todos)
                        · sin filas = sin restricción
municipio_veda          municipio_id PK, activa bool, inicio, fin            (Fase 2)
bloques_contenido       id, municipio_id, tipo, orden, datos jsonb, ocultar_en_veda   (Fase 2)
```

### Documentos

```
documentos              id text (nanoid 12), municipio_id, sujeto_obligado_id, nodo_id→indice_nodos,
                        nombre text, periodo_etiqueta text ('Marzo 2026'), periodo_inicio date, periodo_fin date,
                        carpeta_periodo text ('2026-03' | 'permanente'), orden int,
                        estado enum('publicado','oculto','historico','papelera'),
                        tipo enum('archivo','video_externo'), url_externa text,
                        version_actual_id→documento_versiones (FK diferida),
                        publicado_en, creado_por→user, creado_en, actualizado_en, eliminado_en
                        INDEX(municipio_id, sujeto_obligado_id, nodo_id, estado, orden)
                        INDEX(municipio_id, actualizado_en desc)   -- "Recientes"
documento_versiones     id, documento_id, numero int, ruta_r2 text, nombre_original text, mime text,
                        tipo_archivo enum('pdf','word','excel','powerpoint','zip','video','imagen'),
                        tamano bigint, hash_sha256 text, duracion_seg int, miniatura_ruta text,
                        subido_por, creado_en, vigente bool
                        UNIQUE(documento_id, numero)
leyendas_sin_informacion id, municipio_id, sujeto_obligado_id, nodo_id, periodo_etiqueta, periodo_inicio, periodo_fin,
                        texto, creado_por, creado_en, eliminado_en
                        UNIQUE(nodo_id, sujeto_obligado_id, periodo_inicio) WHERE eliminado_en IS NULL
```

Un documento nunca cambia de `nodo_id` ni de versión del índice: si cambia la ley se vuelve a publicar en el nodo nuevo (o la equivalencia lo muestra). Reemplazar archivo = nueva fila en `documento_versiones` + `version_actual_id`.

### Operación

```
bitacora                id bigint identity, ocurrido_en timestamptz default now(),
                        actor_id text, actor_rol text, municipio_id uuid null,
                        entidad text ('documento','documento_version','leyenda','red_social','sujeto_obligado',
                        'tema','miembro','invitacion','alcance','municipio','indice_version'),
                        entidad_id text, accion text ('crear','actualizar','eliminar' + detalle semántico
                        calculado: 'renombrar','reemplazar','reordenar','ocultar','papelera','restaurar'...),
                        cambios jsonb ({ campo: { antes, despues } }), origen text ('panel','migracion','auth')
                        INDEX(municipio_id, ocurrido_en desc) · INDEX(actor_id, ocurrido_en desc)
                        INDEX(entidad, entidad_id, ocurrido_en desc)
exportaciones           id, municipio_id, solicitante_id, estado enum('pendiente','generando','lista','error'),
                        ruta_r2, mensaje_error, creada_en, terminada_en
revalidaciones_pendientes id, municipio_id, etiquetas text[], intentos int, ultimo_error, creada_en
                        -- cola/outbox de invalidación de caché (ver entregable 6)
configuracion           clave text PK, valor jsonb   -- umbrales del semáforo, límites de tamaño, lista de bots...
```

## 4. Vistas para el sitio público (`schema publico`)

`publico.nodos` (índice vigente + histórico por tipo de sujeto), `publico.documentos` (solo `estado='publicado'`, con su versión vigente, sin `creado_por`), `publico.leyendas`, `publico.redes_sociales` (solo `visible`), `publico.tema`, `publico.sujetos_obligados`, `publico.municipio`. `lector_publico` solo tiene `SELECT` sobre este esquema. Las vistas se definen `WITH (security_invoker = true)` para que la RLS de las tablas base aplique.

## 5. Row Level Security

Se activa con `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` en toda tabla con `municipio_id`: `documentos`, `documento_versiones` (por join a `documentos`), `leyendas_sin_informacion`, `redes_sociales`, `sujetos_obligados`, `municipio_tema`, `municipio_dominios`, `exportaciones`, `alcances_miembro`, `bitacora` (solo lectura). Las tablas de catálogo (`estados`, `indice_*`, `tipos_sujeto_obligado`) no llevan RLS: son públicas y solo las escribe el superadmin (permiso en la capa de aplicación).

Variables de sesión (se fijan por transacción con `set_config(..., true)`):

| Variable                    | Quién la fija | Valor                                                                      |
| --------------------------- | ------------- | -------------------------------------------------------------------------- |
| `app.usuario_id`            | panel         | id del usuario                                                             |
| `app.rol`                   | panel         | `superadmin` o el rol de la membresía activa                               |
| `app.municipios_permitidos` | panel         | ids de los municipios donde el usuario tiene membresía, separados por coma |
| `app.municipio_id`          | sitio público | el municipio de esa app (desde `MUNICIPIO_SLUG`)                           |

Función auxiliar en SQL:

```sql
CREATE FUNCTION app.municipio_permitido(m uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.rol', true) = 'superadmin'
      OR m = ANY (string_to_array(current_setting('app.municipios_permitidos', true), ',')::uuid[])
$$;
```

Políticas principales (patrón repetido en cada tabla):

```sql
-- panel: lee y escribe solo sus municipios
CREATE POLICY panel_select ON documentos FOR SELECT TO app_panel USING (app.municipio_permitido(municipio_id));
CREATE POLICY panel_insert ON documentos FOR INSERT TO app_panel WITH CHECK (app.municipio_permitido(municipio_id));
CREATE POLICY panel_update ON documentos FOR UPDATE TO app_panel
  USING (app.municipio_permitido(municipio_id)) WITH CHECK (app.municipio_permitido(municipio_id));
-- sitio público: solo publicados de SU municipio
CREATE POLICY publico_select ON documentos FOR SELECT TO lector_publico
  USING (municipio_id = current_setting('app.municipio_id', true)::uuid AND estado = 'publicado');
```

Si la variable no existe, `current_setting(..., true)` devuelve `NULL`, la comparación es falsa y **no se ve nada**: fallar cerrado.

El alcance fino (capturista limitado a ciertos sujetos obligados o fracciones) **no** va en RLS: lo valida la capa de permisos de la app (`alcances_miembro`). RLS es la red de seguridad por municipio; la capa de app es la autorización de verdad.

Pruebas (Vitest contra Postgres real en Docker; en CI, rama de Neon): usuario de A no lee ni escribe en B; supervisor solo ve asignados; `lector_publico` no ve `oculto/historico/papelera` ni otro municipio; escritura sin `app.usuario_id` falla.

## 6. Triggers de bitácora

Una función genérica `app.registrar_bitacora()` en `AFTER INSERT OR UPDATE OR DELETE` de cada tabla de negocio:

1. Lee `actor := current_setting('app.usuario_id', true)`. Si es `NULL` → `RAISE EXCEPTION 'Escritura sin usuario (app.usuario_id)'`. Esto hace imposible escribir desde el panel sin pasar por el helper.
2. Calcula `cambios` comparando `to_jsonb(OLD)` y `to_jsonb(NEW)` campo por campo (solo los que cambiaron; excluye `actualizado_en`).
3. Deriva la `accion` semántica: cambió `nombre` → `renombrar`; `estado` → `ocultar`/`papelera`/`restaurar`/`historico`; `orden` → `reordenar`; `version_actual_id` → `reemplazar`; `periodo_*` → `cambiar_periodo`.
4. Inserta en `bitacora` con `municipio_id` de la fila, `actor_rol` de `app.rol`, `origen` de `app.origen` (default `panel`).

**Tablas de Better Auth** (`member`, `invitation`): Better Auth escribe con su propio cliente y no pasa por el helper, así que su trigger **no rechaza** si falta la variable: usa `COALESCE(current_setting('app.usuario_id', true), NEW.inviter_id | NEW.user_id)` como actor y `origen='auth'`. Para las acciones críticas (cambiar rol, dar de baja) el panel **no** usa la API de Better Auth: escribe en `member` dentro de `conUsuario` y revoca sesiones con `auth.api.revokeUserSessions`. Así el actor real siempre queda registrado.

Append-only:

```sql
CREATE FUNCTION app.bitacora_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'La bitácora es de solo escritura'; END $$;
CREATE TRIGGER bitacora_sin_update_delete BEFORE UPDATE OR DELETE OR TRUNCATE ON bitacora
  FOR EACH STATEMENT EXECUTE FUNCTION app.bitacora_inmutable();
REVOKE UPDATE, DELETE, TRUNCATE ON bitacora FROM PUBLIC, app_panel, lector_publico;
```

Límite honesto: el rol dueño (`migraciones`) y el administrador de Neon podrían deshabilitar el trigger. Mitigación: credencial de `migraciones` solo en CI y en tu máquina; el respaldo `pg_dump` en R2 conserva copia externa.

## 7. Helper de transacción (`packages/db`)

```ts
type Contexto = {
  usuarioId: string
  rol: Rol
  municipiosPermitidos: string[]
  origen?: 'panel' | 'migracion'
}

export function conUsuario<T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.usuario_id', ${ctx.usuarioId}, true),
             set_config('app.rol', ${ctx.rol}, true),
             set_config('app.municipios_permitidos', ${ctx.municipiosPermitidos.join(',')}, true),
             set_config('app.origen', ${ctx.origen ?? 'panel'}, true)`)
    return fn(tx)
  })
}

export function comoPublico<T>(municipioId: string, fn: (tx: Tx) => Promise<T>): Promise<T> // sitios
```

- Es la **única** exportación de escritura de `packages/db`; el `db` crudo no se exporta a las apps (regla de ESLint `no-restricted-imports`).
- `set_config(..., true)` = `SET LOCAL`: muere con la transacción, no contamina la conexión del pool.
- En producción el panel usa `@neondatabase/serverless` con **Pool (WebSocket)**, no el driver HTTP: el HTTP no mantiene transacciones y las variables se perderían. Los sitios públicos sí pueden usar HTTP para lecturas sueltas, pero `comoPublico` también abre transacción para fijar `app.municipio_id`; el costo es mínimo porque casi todo se sirve desde caché.
- El cliente se elige por variable de entorno: `DATABASE_DRIVER=postgres|neon`.

## 8. Reglas del semáforo (para `packages/indice`, sección 5.2)

Función pura `estadoNodo(nodo, documentos, leyendas, hoy, config)`:

- `permanente`: verde si hay ≥ 1 documento publicado; rojo si no.
- Periódicos: el periodo vigente es el último cerrado (ej. en abril, el 1er trimestre). Plazo = fin del periodo + `dias_gracia` (configurable, default 30; valor legal por confirmar con el supervisor).
- Verde: hay documento o leyenda para el periodo vigente. Amarillo: no hay y faltan ≤ `dias_aviso` (default 10) para el plazo. Rojo: pasó el plazo sin nada, o nunca ha tenido nada.
- Umbrales en `configuracion` (global) con override por municipio en Fase 2.
