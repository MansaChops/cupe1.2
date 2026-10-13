-- Moves the live product catalogue (previously hard-coded in src/data/fixtures.ts) into the
-- database, and links existing real orders to customers and payment records. Everything here is
-- real store data, so nothing is marked is_demo. All inserts are idempotent.
INSERT INTO "products" ("id", "slug", "name", "category", "short_description", "description", "image_file", "featured", "active", "pre_order", "show_size_guide", "sort_order", "created_at", "updated_at") VALUES
  ('prod_1', 'bpc-157', 'BPC-157', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'bpc-157.png', true, true, false, false, 1, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_2', 'ghk-cu', 'GHK-Cu', 'copper-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'ghk-cu.png', true, true, false, false, 2, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_5', 'ipamorelin', 'Ipamorelin', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-slate.png', false, true, true, false, 5, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_6', 'cjc-1295-no-dac', 'CJC-1295 (no DAC)', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-slate.png', false, true, true, false, 6, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_7', 'selank', 'Selank', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-verdigris.png', false, true, true, false, 7, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_8', 'semax', 'Semax', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-verdigris.png', false, true, true, false, 8, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_9', 'epitalon', 'Epitalon', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-amber.png', false, true, true, false, 9, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_10', 'kpv', 'KPV', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-amber.png', false, true, false, false, 10, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_11', 'bacteriostatic-water', 'Bacteriostatic Water', 'supplies', 'Multi-use diluent in a sealed glass vial with flip-off cap.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'vial-slate.png', false, true, false, false, 11, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_12', 'alcohol-prep-pads-100', 'Alcohol Prep Pads (100)', 'supplies', 'Individually sealed 70% isopropyl prep pads.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'alcohol-prep-pads.jpg', false, true, false, false, 12, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_15', '30g-pin', '30G Pin', 'supplies', '30 gauge pins, individually sealed. Sold in packs of 10, up to 50 per order.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', '30g-pin.webp', false, true, false, false, 15, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_13', 'mt2', 'MT2', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'mt2.png', true, true, false, false, 13, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('prod_14', 'reta', 'Reta', 'single-peptides', 'Supplied as a lyophilised powder in a sealed 3ml glass vial with an aluminium crimp cap. Store refrigerated and away from light.', 'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.', 'reta.png', true, true, false, true, 14, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "product_variants" ("id", "product_id", "inventory_code", "name", "sku", "price_pence", "sale_price_pence", "stock", "low_stock_threshold", "pack_size", "max_per_order", "active", "sort_order", "created_at", "updated_at") VALUES
  ('var_1_1', 'prod_1', 'INV-0011', '10mg', 'BPC10', 1500, NULL, 36, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_2_1', 'prod_2', 'INV-0021', '100mg', 'GHK100', 2500, NULL, 62, 6, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_5_1', 'prod_5', 'INV-0051', '5mg', 'IPA5', 2650, NULL, 22, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_6_1', 'prod_6', 'INV-0061', '2mg', 'CJC2', 2375, NULL, 0, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_6_2', 'prod_6', 'INV-0062', '5mg', 'CJC5', 3840, NULL, 7, 5, 1, NULL, true, 1, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_7_1', 'prod_7', 'INV-0071', '5mg', 'SEL5', 2730, NULL, 16, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_8_1', 'prod_8', 'INV-0081', '5mg', 'SMX5', 2730, NULL, 2, 4, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_9_1', 'prod_9', 'INV-0091', '10mg', 'EPI10', 3120, NULL, 25, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_9_2', 'prod_9', 'INV-0092', '50mg', 'EPI50', 8900, NULL, 6, 2, 1, NULL, true, 1, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_10_1', 'prod_10', 'INV-0101', '5mg', 'KPV5', 2580, NULL, 14, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_11_1', 'prod_11', 'INV-0111', '10ml', 'BAC10', 650, NULL, 120, 25, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_11_2', 'prod_11', 'INV-0112', '30ml', 'BAC30', 1190, NULL, 48, 10, 1, NULL, true, 1, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_12_1', 'prod_12', 'INV-0121', 'Box of 100', 'SWAB100', 425, NULL, 63, 15, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_15_1', 'prod_15', 'INV-0151', '30G', 'PIN30G', 50, NULL, 500, 50, 10, 50, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_13_1', 'prod_13', 'INV-0131', '10mg', 'MT10', 2500, NULL, 20, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_14_1', 'prod_14', 'INV-0141', '10mg', 'RETA10', 5000, NULL, 20, 5, 1, NULL, true, 0, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_14_2', 'prod_14', 'INV-0142', '20mg', 'RETA20', 9000, NULL, 20, 5, 1, NULL, true, 1, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z'),
  ('var_14_3', 'prod_14', 'INV-0143', '30mg', 'RETA30', 13000, NULL, 20, 5, 1, NULL, true, 2, '2026-06-02T09:14:00Z', '2026-09-28T16:40:00Z')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Opening stock level for each variant, so the movement history adds up to current stock.
INSERT INTO "inventory_movements" ("variant_id", "reason", "delta", "stock_after", "note", "created_at")
SELECT "id", 'INITIAL', "stock", "stock", 'Opening stock (catalogue import)', now()
FROM "product_variants"
WHERE NOT EXISTS (SELECT 1 FROM "inventory_movements" m WHERE m."variant_id" = "product_variants"."id");
--> statement-breakpoint
-- One customer per email address from existing orders, using their most recent details.
INSERT INTO "customers" ("email", "name", "phone", "address", "city", "postcode", "country", "created_at", "updated_at")
SELECT DISTINCT ON (lower("email")) "email", "customer_name", "phone", "address", "city", "postcode", "country",
  (SELECT min(o2."created_at") FROM "orders" o2 WHERE lower(o2."email") = lower("orders"."email")), "created_at"
FROM "orders"
ORDER BY lower("email"), "created_at" DESC
ON CONFLICT ((lower("email"))) DO NOTHING;
--> statement-breakpoint
UPDATE "orders" SET "customer_id" = c."id"
FROM "customers" c
WHERE "orders"."customer_id" IS NULL AND lower(c."email") = lower("orders"."email");
--> statement-breakpoint
UPDATE "orders" SET "updated_at" = "created_at";
--> statement-breakpoint
-- Existing orders were placed without online payment; record each as a pending manual payment.
INSERT INTO "payments" ("order_id", "provider", "status", "amount_pence", "created_at", "updated_at")
SELECT o."id", 'manual', o."payment_status", o."total_pence", o."created_at", o."created_at"
FROM "orders" o
WHERE NOT EXISTS (SELECT 1 FROM "payments" p WHERE p."order_id" = o."id");
