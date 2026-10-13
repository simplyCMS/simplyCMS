/**
 * HTTP-API Mailpit: спільний polling для `live:smoke` і гейта `gate-mail` пілота.
 *
 * Мережевий збій не кидає виняток: хелпер повторює спробу до дедлайну й повертає
 * текст останньої помилки, щоб гейт показав причину у FAIL, а не впав необробленим.
 * Тіла й посилання листів сюди лише ЧИТАЮТЬСЯ — друкувати їх викликачам не слід.
 */
import { setTimeout as sleep } from 'node:timers/promises';

const trimApi = (api) => api.replace(/\/+$/, '');

/** Чистка скриньки (лише через API Mailpit). */
export async function clearMailbox(api) {
  const res = await fetch(`${trimApi(api)}/api/v1/messages`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Mailpit DELETE: ${res.status}`);
}

/**
 * Чекає лист, що задовольняє `match(summary)`.
 *
 * @param {{ api: string, match: (summary: any) => boolean, timeout?: number }} p
 * @returns {Promise<{ mail: { summary: any, text: string, from: string } | null, error: string | null }>}
 */
export async function findMail({ api, match, timeout = 20_000 }) {
  const base = trimApi(api);
  const deadline = Date.now() + timeout;
  let error = null;
  do {
    try {
      const res = await fetch(`${base}/api/v1/messages?limit=200`);
      const { messages = [] } = await res.json();
      const hit = messages.find(match);
      if (hit) {
        const full = await (
          await fetch(`${base}/api/v1/message/${hit.ID}`)
        ).json();
        return {
          mail: { summary: hit, text: full.Text ?? '', from: hit.From.Address },
          error: null,
        };
      }
      error = null;
    } catch (e) {
      error = `Mailpit недоступний: ${e.message}`;
    }
    await sleep(300);
  } while (Date.now() < deadline);
  return { mail: null, error };
}

/** Предикат «лист на адресу `to` з темою, що містить `subject`». */
export const toWithSubject = (to, subject) => (m) =>
  m.To.some((a) => a.Address === to) && m.Subject.includes(subject);

/** Перше посилання в текстовій частині листа. */
export function firstLink(text) {
  return /https?:\/\/[^\s<>"]+/.exec(text)?.[0] ?? null;
}
