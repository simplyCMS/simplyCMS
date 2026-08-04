/**
 * Gate E — bootstrap власника проти ЛОКАЛЬНОГО стеку (ніколи проти живої БД).
 *
 * Доводить три речі, яких поодинці не ловить жоден інший гейт:
 *  1) перший звичайний signup НЕ отримує роль admin — міграція
 *     `first_user_no_auto_admin` лежить у живій схемі, а не лише у файлі;
 *  2) `scripts/owner-invite.mjs` із ШАБЛОНУ магазину ідемпотентний: два
 *     прогони поспіль дають рівно одного власника з роллю admin;
 *  3) `/auth/confirm` обмінює `token_hash` на сесію, ставить auth-cookies і
 *     редиректить на `/auth/set-password`.
 *
 * 🔴 Гейт вимагає service_role-ключа, тому ганяється ЛИШЕ в режимі `--e2e`, де
 * ключ дає піднятий стек. У `.env` магазину ключ не потрапляє ніколи — живе
 * лише в env дочірнього процесу owner-invite.
 */

import { createClient } from '@supabase/supabase-js';
import {
  OWNER_EMAIL,
  checkConfirmRedirect,
  checkFirstSignupIsNotAdmin,
  checkOwnerInvite,
} from './gate-e-checks.mjs';

/**
 * Явний пропуск замість тиші: у режимах без стеку звіт має ПОКАЗАТИ, що
 * owner-флоу не перевірявся, і при цьому не червоніти (`ok: true`).
 *
 * @param {string} reason
 * @returns {{ ok: boolean; skipped: boolean; details: string[] }}
 */
export function skippedOwnerGate(reason) {
  return { ok: true, skipped: true, details: [`SKIP ${reason}`] };
}

/**
 * @param {{ storeDir: string; port: number; env: Record<string,string>; serviceRoleKey: string }} opts
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function gateOwner({ storeDir, port, env, serviceRoleKey }) {
  // Той самий вираз адреси, що й у Gate B: сервер скретча слухає 127.0.0.1.
  const storeUrl = `http://127.0.0.1:${port}`;
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const anonKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const details = [];
  let ok = true;
  /** Одна перевірка: у звіт іде ФАКТ, а не лише вердикт (як у Gate B). */
  const check = (label, passed, fact) => {
    details.push(`${passed ? 'OK  ' : 'FAIL'} ${label} — ${fact}`);
    if (!passed) ok = false;
  };

  const signup = await checkFirstSignupIsNotAdmin(anon, admin);
  check('перший signup БЕЗ ролі admin', signup.passed, signup.fact);

  const invite = await checkOwnerInvite(admin, storeDir, {
    ...process.env,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SITE_URL: storeUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    OWNER_EMAIL,
  });
  check('owner-invite ідемпотентний + роль admin', invite.passed, invite.fact);

  // Без власника перевіряти /auth/confirm нема на кому. Це не «пропуск», а
  // наслідок падіння вище — тому FAIL із поясненням, а не тиша.
  if (invite.passed) {
    const confirm = await checkConfirmRedirect(admin, storeUrl);
    check('GET /auth/confirm', confirm.passed, confirm.fact);
  } else {
    check('GET /auth/confirm', false, 'не запускався: owner-invite впав');
  }

  return { ok, details };
}
