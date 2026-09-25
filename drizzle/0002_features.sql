CREATE TABLE "feature_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"feature" text NOT NULL,
	"enabled" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_by_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "battle_enabled" boolean DEFAULT false NOT NULL;