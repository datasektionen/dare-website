CREATE TABLE "game_score_removals" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"runs" integer NOT NULL,
	"best_score" integer NOT NULL,
	"removed_by" text NOT NULL,
	"removed_by_name" text NOT NULL,
	"removed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"score" integer NOT NULL,
	"cans" integer NOT NULL,
	"distance" integer NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_scores_non_negative" CHECK ("game_scores"."score" >= 0 AND "game_scores"."cans" >= 0 AND "game_scores"."distance" >= 0),
	CONSTRAINT "game_scores_name_length" CHECK (char_length("game_scores"."name") BETWEEN 1 AND 20)
);
--> statement-breakpoint
CREATE INDEX "game_scores_score_idx" ON "game_scores" USING btree ("score" DESC NULLS LAST,"at");