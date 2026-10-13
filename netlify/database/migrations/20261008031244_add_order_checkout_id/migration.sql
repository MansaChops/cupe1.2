ALTER TABLE "orders" ADD COLUMN "checkout_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_checkout_id_key" UNIQUE("checkout_id");