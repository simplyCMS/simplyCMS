import { checkIsAdmin } from './is-admin';
import { invalidateThemeCache } from './themes';

/**
 * Скидання серверного кешу активної теми (TTL 5 хв) після перемикання теми
 * чи зміни її налаштувань в адмінці. Guard: тільки роль admin, інакше 403.
 *
 * 🔴 Логіка живе тут, а не у файлі роуту, і це не косметика: named export із
 * `routes/api/*.tsx` переживає стрипінг властивості `server`, який робить
 * TanStack Start, і тягне в КЛІЄНТСЬКИЙ бандл увесь ланцюг
 * `checkIsAdmin → createServerSupabase → @simplycms/supabase/server-client`.
 * Роут лишає єдиний export `Route`, тому імпорт цього модуля після стрипінгу
 * стає невживаним і зникає при tree-shaking. Регресію спіймав Gate C пілота
 * (`node scripts/pilot-pack.mjs`) — у монорепо-збірці витоку не видно.
 */
export async function revalidateTheme(): Promise<Response> {
  if (!(await checkIsAdmin())) {
    // Машинний код, а не текст: тіло цієї відповіді не читає жоден клієнт
    // (адмінка дивиться лише `response.ok`), а серверний обробник живе поза
    // React і транслятора не має. Локалізувати рядок, який ніхто не показує,
    // означало б тягнути локаль у серверний шар заради нічого.
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  invalidateThemeCache();
  return Response.json({ revalidated: true }, { status: 200 });
}
