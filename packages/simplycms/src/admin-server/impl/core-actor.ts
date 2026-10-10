import type { RequestGrant } from 'simplycms/auth';

/**
 * Актор доменного ядра адмінки (С-15): хто виконує дію, коли ядро кличуть
 * поза операцією (сід, порти, майбутній MCP-сервер магазину).
 *
 * 🔴 Дискримінант, а не `string | null`: `null` у ролі «система» читається
 * як забута перевірка, а `kind: 'system'` — як свідоме рішення викликача.
 * Ядро, що пише автора дії (`changed_by`) чи перевіряє «не я», для
 * `system` поводиться як автоправило: автора немає, перевірки «не я» теж.
 * Операція передає `{ kind: 'admin', userId }` із гранта сесії.
 */
export type CoreActor = { kind: 'admin'; userId: string } | { kind: 'system' };

/**
 * Актор ядра з гранта операції. `userId: null` за типом `AuthzSubject`
 * (гість) адмін-грант на практиці не отримує, але до С-15 операції писали
 * `changed_by = null` і пропускали «не я» (`id === null` хибне) — тобто вже
 * поводились як `system`. Мапінг зберігає цю поведінку, нової гілки немає.
 */
export const actorOfGrant = ({ subject }: RequestGrant): CoreActor =>
  subject.userId === null
    ? { kind: 'system' }
    : { kind: 'admin', userId: subject.userId };
