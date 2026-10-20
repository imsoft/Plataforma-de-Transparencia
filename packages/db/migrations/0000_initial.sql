CREATE TYPE "public"."document_status" AS ENUM('published', 'hidden', 'historical', 'trash');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('file', 'external_video');--> statement-breakpoint
CREATE TYPE "public"."equivalence_type" AS ENUM('exact', 'partial');--> statement-breakpoint
CREATE TYPE "public"."export_status" AS ENUM('pending', 'generating', 'ready', 'error');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('pdf', 'word', 'excel', 'powerpoint', 'zip', 'video', 'image');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('monthly', 'quarterly', 'semiannual', 'annual', 'permanent');--> statement-breakpoint
CREATE TYPE "public"."municipality_status" AS ENUM('active', 'panel_suspended');--> statement-breakpoint
CREATE TYPE "public"."node_level" AS ENUM('article', 'fraction', 'item', 'subitem');--> statement-breakpoint
CREATE TYPE "public"."template" AS ENUM('classic-institutional', 'modern-minimalist', 'citizen-services');--> statement-breakpoint
CREATE TYPE "public"."version_status" AS ENUM('draft', 'current', 'historical');--> statement-breakpoint
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
	"job_title" text,
	"phone" text,
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
CREATE TABLE "law_index_equivalences" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"type" "equivalence_type" DEFAULT 'exact' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "law_index_nodes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version_id" uuid NOT NULL,
	"subject_type_id" uuid NOT NULL,
	"parent_id" uuid,
	"level" "node_level" NOT NULL,
	"number" text NOT NULL,
	"label" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"key" text,
	"route_slug" text,
	"frequency" "frequency" NOT NULL,
	"frequency_to_confirm" boolean DEFAULT false NOT NULL,
	"storage_folder" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "law_index_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"state_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"effective_date" date,
	"status" "version_status" DEFAULT 'draft' NOT NULL,
	"storage_folder" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligated_subject_types" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "obligated_subject_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "states_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"document_id" text NOT NULL,
	"number" integer NOT NULL,
	"storage_path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"size" bigint NOT NULL,
	"hash_sha256" text,
	"duration_sec" integer,
	"thumbnail_path" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"municipality_id" uuid NOT NULL,
	"obligated_subject_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"name" text NOT NULL,
	"period_label" text,
	"period_start" date,
	"period_end" date,
	"period_folder" text DEFAULT 'permanent' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "document_status" DEFAULT 'published' NOT NULL,
	"type" "document_type" DEFAULT 'file' NOT NULL,
	"external_url" text,
	"current_version_id" uuid,
	"published_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "no_information_notices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"obligated_subject_id" uuid NOT NULL,
	"node_id" uuid NOT NULL,
	"period_label" text,
	"period_start" date,
	"period_end" date,
	"text" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_scopes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" text NOT NULL,
	"municipality_id" uuid NOT NULL,
	"obligated_subject_id" uuid,
	"node_id" uuid
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"state_id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"official_name" text NOT NULL,
	"status" "municipality_status" DEFAULT 'active' NOT NULL,
	"revalidation_url" text,
	"revalidation_secret_hash" text,
	"contact_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "municipalities_organizationId_unique" UNIQUE("organization_id"),
	CONSTRAINT "municipalities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "municipality_domains" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"host" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "municipality_domains_host_unique" UNIQUE("host")
);
--> statement-breakpoint
CREATE TABLE "municipality_theme" (
	"municipality_id" uuid PRIMARY KEY NOT NULL,
	"template" "template" DEFAULT 'classic-institutional' NOT NULL,
	"primary_color" text DEFAULT '#125c6a' NOT NULL,
	"secondary_color" text DEFAULT '#35505e' NOT NULL,
	"accent_color" text DEFAULT '#5b7a8c' NOT NULL,
	"typeface" text DEFAULT 'Inter' NOT NULL,
	"coat_of_arms_path" text,
	"administration_logo_path" text,
	"images" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obligated_subjects" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"subject_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_networks" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"obligated_subject_id" uuid,
	"network" text NOT NULL,
	"other_name" text,
	"url" text NOT NULL,
	"text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"hide_during_blackout" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL,
	"actor_role" text,
	"municipality_id" uuid,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb,
	"origin" text DEFAULT 'panel' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"requester_id" text NOT NULL,
	"status" "export_status" DEFAULT 'pending' NOT NULL,
	"storage_path" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pending_revalidations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"tags" text[] NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_index_equivalences" ADD CONSTRAINT "law_index_equivalences_source_node_id_law_index_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."law_index_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_index_equivalences" ADD CONSTRAINT "law_index_equivalences_target_node_id_law_index_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."law_index_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_index_nodes" ADD CONSTRAINT "law_index_nodes_version_id_law_index_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."law_index_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_index_nodes" ADD CONSTRAINT "law_index_nodes_subject_type_id_obligated_subject_types_id_fk" FOREIGN KEY ("subject_type_id") REFERENCES "public"."obligated_subject_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_index_versions" ADD CONSTRAINT "law_index_versions_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_obligated_subject_id_obligated_subjects_id_fk" FOREIGN KEY ("obligated_subject_id") REFERENCES "public"."obligated_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_node_id_law_index_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."law_index_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_information_notices" ADD CONSTRAINT "no_information_notices_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_information_notices" ADD CONSTRAINT "no_information_notices_obligated_subject_id_obligated_subjects_id_fk" FOREIGN KEY ("obligated_subject_id") REFERENCES "public"."obligated_subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_information_notices" ADD CONSTRAINT "no_information_notices_node_id_law_index_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."law_index_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "no_information_notices" ADD CONSTRAINT "no_information_notices_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_scopes" ADD CONSTRAINT "member_scopes_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_scopes" ADD CONSTRAINT "member_scopes_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_scopes" ADD CONSTRAINT "member_scopes_obligated_subject_id_obligated_subjects_id_fk" FOREIGN KEY ("obligated_subject_id") REFERENCES "public"."obligated_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_scopes" ADD CONSTRAINT "member_scopes_node_id_law_index_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."law_index_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_state_id_states_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."states"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_domains" ADD CONSTRAINT "municipality_domains_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_theme" ADD CONSTRAINT "municipality_theme_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligated_subjects" ADD CONSTRAINT "obligated_subjects_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligated_subjects" ADD CONSTRAINT "obligated_subjects_subject_type_id_obligated_subject_types_id_fk" FOREIGN KEY ("subject_type_id") REFERENCES "public"."obligated_subject_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_networks" ADD CONSTRAINT "social_networks_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_networks" ADD CONSTRAINT "social_networks_obligated_subject_id_obligated_subjects_id_fk" FOREIGN KEY ("obligated_subject_id") REFERENCES "public"."obligated_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_revalidations" ADD CONSTRAINT "pending_revalidations_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "law_index_equivalences_pair" ON "law_index_equivalences" USING btree ("source_node_id","target_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "law_index_nodes_key_unique" ON "law_index_nodes" USING btree ("version_id","subject_type_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "law_index_nodes_route_slug_unique" ON "law_index_nodes" USING btree ("version_id","subject_type_id","route_slug");--> statement-breakpoint
CREATE INDEX "law_index_nodes_parent_order" ON "law_index_nodes" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "law_index_nodes_version_type" ON "law_index_nodes" USING btree ("version_id","subject_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "law_index_versions_state_slug" ON "law_index_versions" USING btree ("state_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "law_index_versions_current_unique" ON "law_index_versions" USING btree ("state_id") WHERE "law_index_versions"."status" = 'current';--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_number" ON "document_versions" USING btree ("document_id","number");--> statement-breakpoint
CREATE INDEX "documents_node" ON "documents" USING btree ("municipality_id","obligated_subject_id","node_id","status","sort_order");--> statement-breakpoint
CREATE INDEX "documents_recent" ON "documents" USING btree ("municipality_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "no_information_notices_period_unique" ON "no_information_notices" USING btree ("node_id","obligated_subject_id","period_start") WHERE "no_information_notices"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "member_scopes_member" ON "member_scopes" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "obligated_subjects_prefix" ON "obligated_subjects" USING btree ("municipality_id","prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "obligated_subjects_type" ON "obligated_subjects" USING btree ("municipality_id","subject_type_id");--> statement-breakpoint
CREATE INDEX "social_networks_municipality" ON "social_networks" USING btree ("municipality_id","obligated_subject_id","sort_order");--> statement-breakpoint
CREATE INDEX "audit_log_municipality_date" ON "audit_log" USING btree ("municipality_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_date" ON "audit_log" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity" ON "audit_log" USING btree ("entity","entity_id","occurred_at");--> statement-breakpoint
CREATE INDEX "pending_revalidations_municipality" ON "pending_revalidations" USING btree ("municipality_id","created_at");