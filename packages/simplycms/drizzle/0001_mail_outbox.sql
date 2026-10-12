CREATE TABLE "mail_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"message" jsonb NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "mail_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "mail_outbox_admin_all" ON "mail_outbox" AS PERMISSIVE FOR ALL TO "app_admin" USING (true) WITH CHECK (true);