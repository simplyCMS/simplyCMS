import type { CoreActor, RequestGrant } from 'simplycms/auth';

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
