CREATE INDEX "menu_items_name_id_idx" ON "menu_items" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "outlets_name_id_idx" ON "outlets" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "sales_outlet_created_id_idx" ON "sales" USING btree ("outlet_id","created_at","id");--> statement-breakpoint
-- Create the replacement before dropping the old index so sales are never unindexed.
DROP INDEX "sales_outlet_created_at_idx";