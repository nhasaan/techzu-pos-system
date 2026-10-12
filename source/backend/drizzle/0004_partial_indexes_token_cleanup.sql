ALTER TABLE "sales" DROP CONSTRAINT "sales_outlet_idempotency_unique";--> statement-breakpoint
DROP INDEX "tokens_revoked_at_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "sales_outlet_idempotency_unique" ON "sales" USING btree ("outlet_id","idempotency_key") WHERE "sales"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tokens_expires_at_idx" ON "tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tokens_revoked_at_idx" ON "tokens" USING btree ("revoked_at") WHERE "tokens"."revoked_at" IS NOT NULL;