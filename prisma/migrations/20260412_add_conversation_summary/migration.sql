-- AddColumn summary to Conversation (nullable, safe migration)
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "summary" TEXT;
