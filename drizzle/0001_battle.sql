CREATE TABLE "battle" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"jaeger" integer DEFAULT 0 NOT NULL,
	"minttu" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_singleton" CHECK ("battle"."id" = 1),
	CONSTRAINT "battle_non_negative" CHECK ("battle"."jaeger" >= 0 AND "battle"."minttu" >= 0)
);
--> statement-breakpoint
CREATE TABLE "battle_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"side" text,
	"by" text NOT NULL,
	"by_name" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
