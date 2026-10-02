CREATE TABLE "battle_judge_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"kthid" text NOT NULL,
	"name" text,
	"added" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_by_name" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_judges" (
	"kthid" text PRIMARY KEY NOT NULL,
	"name" text,
	"added_by" text NOT NULL,
	"added_by_name" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
