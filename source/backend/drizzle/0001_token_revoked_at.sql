ALTER TABLE "tokens" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "tokens_revoked_at_idx" ON "tokens" USING btree ("revoked_at");