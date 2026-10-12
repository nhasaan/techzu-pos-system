CREATE TYPE "public"."token_status" AS ENUM('active', 'revoked', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('hqadmin', 'outletadmin', 'superadmin');--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"outlet_id" bigint NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_outlet_menu_item_unique" UNIQUE("outlet_id","menu_item_id"),
	CONSTRAINT "inventory_stock_non_negative" CHECK ("inventory"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_items_base_price_non_negative" CHECK ("menu_items"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outlet_menu_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outlet_menu_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"outlet_id" bigint NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outlet_menu_items_outlet_menu_unique" UNIQUE("outlet_id","menu_item_id"),
	CONSTRAINT "outlet_menu_items_price_non_negative" CHECK ("outlet_menu_items"."price" IS NULL OR "outlet_menu_items"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outlets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"address" text,
	"receipt_seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sale_id" bigint NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"price_at_sale" numeric(10, 2) NOT NULL,
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_price_non_negative" CHECK ("sale_items"."price_at_sale" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"outlet_id" bigint NOT NULL,
	"receipt_number" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"idempotency_key" text,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_outlet_receipt_unique" UNIQUE("outlet_id","receipt_number"),
	CONSTRAINT "sales_outlet_idempotency_unique" UNIQUE("outlet_id","idempotency_key"),
	CONSTRAINT "sales_total_non_negative" CHECK ("sales"."total_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"jti" text NOT NULL,
	"status" "token_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"outlet_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_outlet_required_for_outletadmin" CHECK ("users"."role" <> 'outletadmin' OR "users"."outlet_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "outlet_menu_items_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlet_menu_items" ADD CONSTRAINT "outlet_menu_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_menu_item_id_idx" ON "inventory" USING btree ("menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_items_name_lower_unique" ON "menu_items" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "outlet_menu_items_menu_item_id_idx" ON "outlet_menu_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outlets_name_lower_unique" ON "outlets" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_menu_item_id_idx" ON "sale_items" USING btree ("menu_item_id");--> statement-breakpoint
CREATE INDEX "sales_outlet_created_at_idx" ON "sales" USING btree ("outlet_id","created_at");--> statement-breakpoint
CREATE INDEX "tokens_user_id_status_idx" ON "tokens" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "users_outlet_id_idx" ON "users" USING btree ("outlet_id");