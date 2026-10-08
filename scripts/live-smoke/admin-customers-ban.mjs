/**
 * Частина «бан» кроку К3-Е6г (`./admin-customers.mjs`): власник банить B →
 * сесій немає, відкрита вкладка B після перезавантаження гостьова (без
 * `pageerror`), `GET /admin` → `/auth`, вхід B → текст бану (Е6г-13, код
 * `BANNED`, а не загальна помилка).
 */
import * as q from './admin-customers-sql.mjs';
import * as ui from './admin-customers-owner.mjs';
import * as buyer from './admin-customers-buyer.mjs';

export async function banPart({
  page,
  pages,
  contexts,
  base,
  dbUrl,
  check,
  st,
}) {
  // Вкладка B відкрита на вітрині ДО бану і має живу сесію.
  await pages.b.goto(`${base}/`, { waitUntil: 'networkidle' });
  const before = await buyer.sessionOf(pages.b);
  const banned = await ui.banFromCard(
    page,
    base,
    st.b.userId,
    'Е6г: тест бану',
  );
  const user = await q.userByEmail(dbUrl, st.b.email);
  const sessions = await q.sessionsCount(dbUrl, st.b.userId);
  await pages.b.reload({ waitUntil: 'networkidle' });
  const guest = await buyer.sessionOf(pages.b);
  const guard = await contexts.b.request.get(`${base}/admin`, {
    maxRedirects: 0,
    failOnStatusCode: false,
  });
  const location = guard.headers().location ?? '';
  check(
    'покупці: власник забанив B — banned_at є, сесій 0, відкрита вкладка після перезавантаження гостьова, GET /admin → /auth',
    banned &&
      before?.user?.email === st.b.email &&
      user?.banned_at !== null &&
      sessions === 0 &&
      guest === null &&
      guard.status() >= 300 &&
      guard.status() < 400 &&
      new URL(location, base).pathname === '/auth',
    `тост ${banned}; сесія до ${before?.user?.email}; banned_at ${user?.banned_at}; сесій ${sessions}; після reload ${JSON.stringify(guest)}; GET /admin ${guard.status()} → ${location}`,
  );
  const text = await buyer.loginAs(
    pages.b,
    base,
    st.b.email,
    'Акаунт заблоковано',
  );
  const none = await buyer.sessionOf(pages.b);
  check(
    'покупці: вхід забаненого B — текст бану (BANNED), сесію не створено',
    text && none === null && (await q.sessionsCount(dbUrl, st.b.userId)) === 0,
    `текст бану ${text}; сесія ${JSON.stringify(none)}`,
  );
}
