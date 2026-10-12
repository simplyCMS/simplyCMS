-- Згенеровано `pnpm db:diff mail_outbox` з packages/simplycms/drizzle/0001_mail_outbox.sql.
-- Джерело правди схеми — packages/simplycms/src/schema/schema.ts.
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

-- ── ручне: гранти й RLS ────────────────────────────────────────────────────
-- drizzle-kit гранти не діфить (data-layer.md). Новий файл канону несе їх сам:
-- baseline заморожений, `0002_grants` нових таблиць не знає.
-- Лише `app_admin`: тіло листа скидання пароля — секрет, покупцеві (`app_user`)
-- черга не потрібна взагалі; ескалація `operator` — це `set local role app_admin`.
revoke all on table public.mail_outbox from public;
grant select, insert, update, delete on table public.mail_outbox to app_admin;
