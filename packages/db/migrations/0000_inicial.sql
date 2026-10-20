CREATE TYPE "public"."estado_documento" AS ENUM('publicado', 'oculto', 'historico', 'papelera');--> statement-breakpoint
CREATE TYPE "public"."estado_exportacion" AS ENUM('pendiente', 'generando', 'lista', 'error');--> statement-breakpoint
CREATE TYPE "public"."estatus_municipio" AS ENUM('activo', 'panel_suspendido');--> statement-breakpoint
CREATE TYPE "public"."estatus_version" AS ENUM('borrador', 'vigente', 'historica');--> statement-breakpoint
CREATE TYPE "public"."nivel_nodo" AS ENUM('articulo', 'fraccion', 'inciso', 'subinciso');--> statement-breakpoint
CREATE TYPE "public"."periodicidad" AS ENUM('mensual', 'trimestral', 'semestral', 'anual', 'permanente');--> statement-breakpoint
CREATE TYPE "public"."plantilla" AS ENUM('institucional-clasica', 'moderna-minimalista', 'ciudadana-servicios');--> statement-breakpoint
CREATE TYPE "public"."tipo_archivo" AS ENUM('pdf', 'word', 'excel', 'powerpoint', 'zip', 'video', 'imagen');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('archivo', 'video_externo');--> statement-breakpoint
CREATE TYPE "public"."tipo_equivalencia" AS ENUM('exacta', 'parcial');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"two_factor_enabled" boolean DEFAULT false,
	"cargo" text,
	"telefono" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estados" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"clave" text NOT NULL,
	"nombre" text NOT NULL,
	CONSTRAINT "estados_clave_unique" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "indice_equivalencias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nodo_origen_id" uuid NOT NULL,
	"nodo_destino_id" uuid NOT NULL,
	"tipo" "tipo_equivalencia" DEFAULT 'exacta' NOT NULL,
	"nota" text
);
--> statement-breakpoint
CREATE TABLE "indice_nodos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version_id" uuid NOT NULL,
	"tipo_sujeto_id" uuid NOT NULL,
	"padre_id" uuid,
	"nivel" "nivel_nodo" NOT NULL,
	"numero" text NOT NULL,
	"etiqueta" text NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"clave" text,
	"ruta_slug" text,
	"periodicidad" "periodicidad" NOT NULL,
	"periodicidad_por_confirmar" boolean DEFAULT false NOT NULL,
	"carpeta_r2" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indice_versiones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"estado_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"fecha_vigencia" date,
	"estatus" "estatus_version" DEFAULT 'borrador' NOT NULL,
	"carpeta_r2" text NOT NULL,
	"publicada_en" timestamp with time zone,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_sujeto_obligado" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	CONSTRAINT "tipos_sujeto_obligado_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "documento_versiones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"documento_id" text NOT NULL,
	"numero" integer NOT NULL,
	"ruta_r2" text NOT NULL,
	"nombre_original" text NOT NULL,
	"mime" text NOT NULL,
	"tipo_archivo" "tipo_archivo" NOT NULL,
	"tamano" bigint NOT NULL,
	"hash_sha256" text,
	"duracion_seg" integer,
	"miniatura_ruta" text,
	"vigente" boolean DEFAULT true NOT NULL,
	"subido_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" text PRIMARY KEY NOT NULL,
	"municipio_id" uuid NOT NULL,
	"sujeto_obligado_id" uuid NOT NULL,
	"nodo_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"periodo_etiqueta" text,
	"periodo_inicio" date,
	"periodo_fin" date,
	"carpeta_periodo" text DEFAULT 'permanente' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"estado" "estado_documento" DEFAULT 'publicado' NOT NULL,
	"tipo" "tipo_documento" DEFAULT 'archivo' NOT NULL,
	"url_externa" text,
	"version_actual_id" uuid,
	"publicado_en" timestamp with time zone,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "leyendas_sin_informacion" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"sujeto_obligado_id" uuid NOT NULL,
	"nodo_id" uuid NOT NULL,
	"periodo_etiqueta" text,
	"periodo_inicio" date,
	"periodo_fin" date,
	"texto" text NOT NULL,
	"creado_por" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"eliminado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "alcances_miembro" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" text NOT NULL,
	"municipio_id" uuid NOT NULL,
	"sujeto_obligado_id" uuid,
	"nodo_id" uuid
);
--> statement-breakpoint
CREATE TABLE "municipio_dominios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"host" text NOT NULL,
	"principal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "municipio_dominios_host_unique" UNIQUE("host")
);
--> statement-breakpoint
CREATE TABLE "municipio_tema" (
	"municipio_id" uuid PRIMARY KEY NOT NULL,
	"plantilla" "plantilla" DEFAULT 'institucional-clasica' NOT NULL,
	"color_primario" text DEFAULT '#1f3a5f' NOT NULL,
	"color_secundario" text DEFAULT '#b8860b' NOT NULL,
	"color_acento" text DEFAULT '#2e7d32' NOT NULL,
	"tipografia" text DEFAULT 'Inter' NOT NULL,
	"escudo_ruta" text,
	"logo_administracion_ruta" text,
	"imagenes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipios" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"estado_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"nombre_oficial" text NOT NULL,
	"estatus" "estatus_municipio" DEFAULT 'activo' NOT NULL,
	"url_revalidacion" text,
	"secreto_revalidacion_hash" text,
	"datos_contacto" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipios_organizationId_unique" UNIQUE("organization_id"),
	CONSTRAINT "municipios_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "redes_sociales" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"sujeto_obligado_id" uuid,
	"red" text NOT NULL,
	"nombre_otra" text,
	"url" text NOT NULL,
	"texto" text,
	"orden" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"ocultar_en_veda" boolean DEFAULT false NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sujetos_obligados" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"tipo_sujeto_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"prefijo" text DEFAULT '' NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bitacora" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bitacora_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"ocurrido_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_rol" text,
	"municipio_id" uuid,
	"entidad" text NOT NULL,
	"entidad_id" text NOT NULL,
	"accion" text NOT NULL,
	"cambios" jsonb,
	"origen" text DEFAULT 'panel' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exportaciones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"solicitante_id" text NOT NULL,
	"estado" "estado_exportacion" DEFAULT 'pendiente' NOT NULL,
	"ruta_r2" text,
	"mensaje_error" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revalidaciones_pendientes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipio_id" uuid NOT NULL,
	"etiquetas" text[] NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"ultimo_error" text,
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indice_equivalencias" ADD CONSTRAINT "indice_equivalencias_nodo_origen_id_indice_nodos_id_fk" FOREIGN KEY ("nodo_origen_id") REFERENCES "public"."indice_nodos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indice_equivalencias" ADD CONSTRAINT "indice_equivalencias_nodo_destino_id_indice_nodos_id_fk" FOREIGN KEY ("nodo_destino_id") REFERENCES "public"."indice_nodos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indice_nodos" ADD CONSTRAINT "indice_nodos_version_id_indice_versiones_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."indice_versiones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indice_nodos" ADD CONSTRAINT "indice_nodos_tipo_sujeto_id_tipos_sujeto_obligado_id_fk" FOREIGN KEY ("tipo_sujeto_id") REFERENCES "public"."tipos_sujeto_obligado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indice_versiones" ADD CONSTRAINT "indice_versiones_estado_id_estados_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."estados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_subido_por_user_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_sujeto_obligado_id_sujetos_obligados_id_fk" FOREIGN KEY ("sujeto_obligado_id") REFERENCES "public"."sujetos_obligados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_nodo_id_indice_nodos_id_fk" FOREIGN KEY ("nodo_id") REFERENCES "public"."indice_nodos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leyendas_sin_informacion" ADD CONSTRAINT "leyendas_sin_informacion_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leyendas_sin_informacion" ADD CONSTRAINT "leyendas_sin_informacion_sujeto_obligado_id_sujetos_obligados_id_fk" FOREIGN KEY ("sujeto_obligado_id") REFERENCES "public"."sujetos_obligados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leyendas_sin_informacion" ADD CONSTRAINT "leyendas_sin_informacion_nodo_id_indice_nodos_id_fk" FOREIGN KEY ("nodo_id") REFERENCES "public"."indice_nodos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leyendas_sin_informacion" ADD CONSTRAINT "leyendas_sin_informacion_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alcances_miembro" ADD CONSTRAINT "alcances_miembro_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alcances_miembro" ADD CONSTRAINT "alcances_miembro_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alcances_miembro" ADD CONSTRAINT "alcances_miembro_sujeto_obligado_id_sujetos_obligados_id_fk" FOREIGN KEY ("sujeto_obligado_id") REFERENCES "public"."sujetos_obligados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alcances_miembro" ADD CONSTRAINT "alcances_miembro_nodo_id_indice_nodos_id_fk" FOREIGN KEY ("nodo_id") REFERENCES "public"."indice_nodos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipio_dominios" ADD CONSTRAINT "municipio_dominios_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipio_tema" ADD CONSTRAINT "municipio_tema_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_estado_id_estados_id_fk" FOREIGN KEY ("estado_id") REFERENCES "public"."estados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipios" ADD CONSTRAINT "municipios_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redes_sociales" ADD CONSTRAINT "redes_sociales_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redes_sociales" ADD CONSTRAINT "redes_sociales_sujeto_obligado_id_sujetos_obligados_id_fk" FOREIGN KEY ("sujeto_obligado_id") REFERENCES "public"."sujetos_obligados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sujetos_obligados" ADD CONSTRAINT "sujetos_obligados_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sujetos_obligados" ADD CONSTRAINT "sujetos_obligados_tipo_sujeto_id_tipos_sujeto_obligado_id_fk" FOREIGN KEY ("tipo_sujeto_id") REFERENCES "public"."tipos_sujeto_obligado"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exportaciones" ADD CONSTRAINT "exportaciones_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revalidaciones_pendientes" ADD CONSTRAINT "revalidaciones_pendientes_municipio_id_municipios_id_fk" FOREIGN KEY ("municipio_id") REFERENCES "public"."municipios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "indice_equivalencias_par" ON "indice_equivalencias" USING btree ("nodo_origen_id","nodo_destino_id");--> statement-breakpoint
CREATE UNIQUE INDEX "indice_nodos_clave_unica" ON "indice_nodos" USING btree ("version_id","tipo_sujeto_id","clave");--> statement-breakpoint
CREATE UNIQUE INDEX "indice_nodos_ruta_slug_unica" ON "indice_nodos" USING btree ("version_id","tipo_sujeto_id","ruta_slug");--> statement-breakpoint
CREATE INDEX "indice_nodos_padre_orden" ON "indice_nodos" USING btree ("padre_id","orden");--> statement-breakpoint
CREATE INDEX "indice_nodos_version_tipo" ON "indice_nodos" USING btree ("version_id","tipo_sujeto_id");--> statement-breakpoint
CREATE UNIQUE INDEX "indice_versiones_estado_slug" ON "indice_versiones" USING btree ("estado_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "indice_versiones_vigente_unica" ON "indice_versiones" USING btree ("estado_id") WHERE "indice_versiones"."estatus" = 'vigente';--> statement-breakpoint
CREATE UNIQUE INDEX "documento_versiones_numero" ON "documento_versiones" USING btree ("documento_id","numero");--> statement-breakpoint
CREATE INDEX "documentos_nodo" ON "documentos" USING btree ("municipio_id","sujeto_obligado_id","nodo_id","estado","orden");--> statement-breakpoint
CREATE INDEX "documentos_recientes" ON "documentos" USING btree ("municipio_id","actualizado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "leyendas_periodo_unica" ON "leyendas_sin_informacion" USING btree ("nodo_id","sujeto_obligado_id","periodo_inicio") WHERE "leyendas_sin_informacion"."eliminado_en" IS NULL;--> statement-breakpoint
CREATE INDEX "alcances_miembro_member" ON "alcances_miembro" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "redes_sociales_municipio" ON "redes_sociales" USING btree ("municipio_id","sujeto_obligado_id","orden");--> statement-breakpoint
CREATE UNIQUE INDEX "sujetos_obligados_prefijo" ON "sujetos_obligados" USING btree ("municipio_id","prefijo");--> statement-breakpoint
CREATE UNIQUE INDEX "sujetos_obligados_tipo" ON "sujetos_obligados" USING btree ("municipio_id","tipo_sujeto_id");--> statement-breakpoint
CREATE INDEX "bitacora_municipio_fecha" ON "bitacora" USING btree ("municipio_id","ocurrido_en");--> statement-breakpoint
CREATE INDEX "bitacora_actor_fecha" ON "bitacora" USING btree ("actor_id","ocurrido_en");--> statement-breakpoint
CREATE INDEX "bitacora_entidad" ON "bitacora" USING btree ("entidad","entidad_id","ocurrido_en");--> statement-breakpoint
CREATE INDEX "revalidaciones_municipio" ON "revalidaciones_pendientes" USING btree ("municipio_id","creada_en");