CREATE TABLE "game_score_removals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"runs" integer NOT NULL,
	"best_score" integer NOT NULL,
	"removed_by" text NOT NULL,
	"removed_by_name" text NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL
);
