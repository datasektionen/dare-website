CREATE TABLE "ticket_url_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text,
	"changed_by" text NOT NULL,
	"changed_by_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "ticket_url" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "ticket_url_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "ticket_url_updated_by" text;