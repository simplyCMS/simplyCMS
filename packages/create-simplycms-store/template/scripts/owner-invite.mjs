// Запуск: OWNER_EMAIL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm owner:invite
// service_role-ключ живе ЛИШЕ в env цього процесу — не в .env.local.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { runOwnerInvite } from './owner-invite-core.mjs';

function readEnvLocal() {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split('\n')
        .filter(
          (line) => line.includes('=') && !line.trimStart().startsWith('#'),
        )
        .map((line) => [
          line.slice(0, line.indexOf('=')).trim(),
          line.slice(line.indexOf('=') + 1).trim(),
        ]),
    );
  } catch {
    return {};
  }
}

const local = readEnvLocal();
const url = process.env.VITE_SUPABASE_URL ?? local.VITE_SUPABASE_URL;
const siteUrl =
  process.env.VITE_SITE_URL ?? local.VITE_SITE_URL ?? 'http://localhost:3000';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;

if (!url || !serviceKey || !email) {
  console.error(
    'Потрібні: VITE_SUPABASE_URL (env або .env.local), SUPABASE_SERVICE_ROLE_KEY і OWNER_EMAIL (env).',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

runOwnerInvite({
  admin,
  email,
  siteUrl,
  resend: process.argv.includes('--resend'),
  log: (message) => console.log(message),
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
