CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"ticket_release_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "ticket_release_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_at" timestamp with time zone NOT NULL,
	"changed_by" text NOT NULL,
	"changed_by_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
