CREATE TYPE "fulfilment_status" AS ENUM('NEW', 'PACKING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "inventory_reason" AS ENUM('INITIAL', 'ORDER', 'CANCELLATION', 'RESTOCK', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('OWNER', 'ADMIN', 'PACKER', 'VIEWER');--> statement-breakpoint
CREATE TYPE "webhook_status" AS ENUM('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');--> statement-breakpoint
CREATE SEQUENCE "public"."demo_order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 900001 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY,
	"user_id" integer,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "costs" (
	"id" serial PRIMARY KEY,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"variant_id" text,
	"amount_pence" integer NOT NULL,
	"incurred_on" date DEFAULT now() NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "costs_amount_nonnegative" CHECK ("amount_pence" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"postcode" text DEFAULT '' NOT NULL,
	"country" text DEFAULT 'United Kingdom' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY,
	"variant_id" text NOT NULL,
	"order_id" integer,
	"user_id" integer,
	"reason" "inventory_reason" NOT NULL,
	"delta" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" serial PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY,
	"order_id" integer NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"status" "payment_status" DEFAULT 'PENDING'::"payment_status" NOT NULL,
	"amount_pence" integer NOT NULL,
	"refunded_pence" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY,
	"product_id" text NOT NULL,
	"inventory_code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"sku" text NOT NULL UNIQUE,
	"price_pence" integer NOT NULL,
	"sale_price_pence" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"pack_size" integer DEFAULT 1 NOT NULL,
	"max_per_order" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_stock_nonnegative" CHECK ("stock" >= 0),
	CONSTRAINT "product_variants_price_positive" CHECK ("price_pence" > 0),
	CONSTRAINT "product_variants_sale_price_valid" CHECK ("sale_price_pence" IS NULL OR ("sale_price_pence" > 0 AND "sale_price_pence" <= "price_pence")),
	CONSTRAINT "product_variants_pack_size_positive" CHECK ("pack_size" >= 1)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_key" text,
	"image_file" text,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"pre_order" boolean DEFAULT false NOT NULL,
	"show_size_guide" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"identity_id" text NOT NULL UNIQUE,
	"email" text NOT NULL UNIQUE,
	"name" text,
	"role" "user_role" DEFAULT 'VIEWER'::"user_role" NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"status" "webhook_status" DEFAULT 'RECEIVED'::"webhook_status" NOT NULL,
	"payload" jsonb NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE "payment_status" USING "payment_status"::"payment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING'::"payment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfilment_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfilment_status" SET DATA TYPE "fulfilment_status" USING "fulfilment_status"::"fulfilment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "fulfilment_status" SET DEFAULT 'NEW'::"fulfilment_status";--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "costs_incurred_on_idx" ON "costs" ("incurred_on");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_key" ON "customers" (lower("email"));--> statement-breakpoint
CREATE INDEX "inventory_movements_variant_idx" ON "inventory_movements" ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_order_idx" ON "inventory_movements" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_order_once" ON "inventory_movements" ("order_id","variant_id") WHERE "reason" = 'ORDER';--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" ("created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_fulfilment_idx" ON "orders" ("fulfilment_status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_key" ON "payments" ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" ("product_id");--> statement-breakpoint
CREATE INDEX "products_active_sort_idx" ON "products" ("active","sort_order");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_key" ON "webhook_events" ("provider","event_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "costs" ADD CONSTRAINT "costs_variant_id_product_variants_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id");--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id");--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive" CHECK ("quantity" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_matches" CHECK ("total_pence" = "subtotal_pence" + "shipping_pence");