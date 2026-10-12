CREATE TABLE "outlet_daily_sales" (
	"outlet_id" bigint NOT NULL,
	"day" date NOT NULL,
	"tx_count" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "outlet_daily_sales_outlet_id_day_pk" PRIMARY KEY("outlet_id","day")
);
--> statement-breakpoint
CREATE TABLE "outlet_item_daily_sales" (
	"outlet_id" bigint NOT NULL,
	"day" date NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "outlet_item_daily_sales_outlet_id_day_menu_item_id_pk" PRIMARY KEY("outlet_id","day","menu_item_id")
);
--> statement-breakpoint
ALTER TABLE "outlet_daily_sales" ADD CONSTRAINT "outlet_daily_sales_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_item_daily_sales" ADD CONSTRAINT "outlet_item_daily_sales_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_item_daily_sales" ADD CONSTRAINT "outlet_item_daily_sales_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outlet_item_daily_sales_menu_item_id_idx" ON "outlet_item_daily_sales" USING btree ("menu_item_id");--> statement-breakpoint
-- Backfill from existing sales (UTC days).
INSERT INTO "outlet_daily_sales" ("outlet_id", "day", "tx_count", "revenue")
SELECT s."outlet_id", (s."created_at" AT TIME ZONE 'UTC')::date, count(*), sum(s."total_amount")
FROM "sales" s
GROUP BY 1, 2;--> statement-breakpoint
INSERT INTO "outlet_item_daily_sales" ("outlet_id", "day", "menu_item_id", "quantity", "revenue")
SELECT s."outlet_id", (s."created_at" AT TIME ZONE 'UTC')::date, si."menu_item_id", sum(si."quantity"), sum(si."quantity" * si."price_at_sale")
FROM "sale_items" si
JOIN "sales" s ON s."id" = si."sale_id"
GROUP BY 1, 2, 3;
