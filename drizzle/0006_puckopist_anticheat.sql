CREATE TABLE "game_admin_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"detail" text NOT NULL,
	"by" text NOT NULL,
	"by_name" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_bans" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"shadow" boolean DEFAULT true NOT NULL,
	"label" text,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"lifted_at" timestamp with time zone,
	"lifted_by" text,
	"lifted_by_name" text
);
--> statement-breakpoint
CREATE TABLE "game_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"seed" integer NOT NULL,
	"key" text NOT NULL,
	"device" text NOT NULL,
	"fingerprint" text,
	"ip" text,
	"status" text DEFAULT 'issued' NOT NULL,
	"rejected" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"ticks" integer,
	"score" integer,
	"cans" integer,
	"distance" integer,
	"flags" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "device" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "ip" text;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_scores" ADD COLUMN "flags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "puckopist_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "puckopist_saving" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "puckopist_hold_flagged" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "puckopist_since" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "game_runs_issued_idx" ON "game_runs" USING btree ("issued_at");--> statement-breakpoint
CREATE INDEX "game_runs_device_idx" ON "game_runs" USING btree ("device");--> statement-breakpoint
ALTER TABLE "game_scores" ADD CONSTRAINT "game_scores_run_id_game_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."game_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_scores_run_idx" ON "game_scores" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "game_scores_device_idx" ON "game_scores" USING btree ("device");--> statement-breakpoint
-- Runs saved before replays existed were never checked.
UPDATE "game_scores" SET "flags" = ARRAY['unverified'] WHERE "run_id" IS NULL;