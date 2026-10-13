CREATE TYPE "discount_type" AS ENUM('PERCENT', 'FIXED', 'FREE_SHIPPING');--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_subtotal_pence" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_value_valid" CHECK (("type" = 'PERCENT' AND "value" BETWEEN 1 AND 100) OR ("type" = 'FIXED' AND "value" > 0) OR "type" = 'FREE_SHIPPING'),
	CONSTRAINT "discount_codes_uses_valid" CHECK ("uses" >= 0 AND ("max_uses" IS NULL OR "uses" <= "max_uses"))
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_pence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "admin_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes" (upper("code"));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_valid" CHECK ("discount_pence" >= 0 AND "discount_pence" <= "subtotal_pence" + "shipping_pence");--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_total_matches", ADD CONSTRAINT "orders_total_matches" CHECK ("total_pence" = "subtotal_pence" + "shipping_pence" - "discount_pence");