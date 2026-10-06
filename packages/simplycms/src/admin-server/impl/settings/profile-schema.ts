import { z } from 'zod';
import {
  SOCIAL_NETWORKS,
  STORE_PROFILE_LIMITS as LIMITS,
} from 'simplycms/contracts/store-profile';

/**
 * Рядок, який форма може лишити порожнім: `''` і пробіли → `null`. Так
 * сховище не тримає двох форм «нічого» (`''` і `null`), а читач (поблажливий
 * `parseStoreProfile`) і так звів би порожнє до `null`.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === '' ? null : v));

/**
 * Посилання соцмережі — лише `https://`. 🔴 `z.url()` сам пропускає `http:`
 * і `javascript:` (будь-яка схема з двокрапкою), а `href` вітрини з
 * `javascript:` — XSS; той самий фільтр стоїть і на читанні
 * (`parseStoreProfile`), але запис мусить відбити його гучно, 400.
 */
const socialUrl = z
  .url()
  .max(LIMITS.socialUrl)
  .refine((v) => v.startsWith('https://'), { message: 'https_only' });

/**
 * Схема запису профілю магазину (Е6б-6, Task 3). Суворість живе тут, а не на
 * читанні: зіпсований рядок вітрина переживає дефолтами, а новий невалідний
 * запис не лягає взагалі. Невідомі ключі відкидаються (`z.object` за
 * замовчуванням їх зрізає) — у jsonb не потрапляє нічого поза контрактом.
 * Межі — `STORE_PROFILE_LIMITS` (T0), ті самі, що бачить форма адмінки.
 */
export const storeProfileInput = z.object({
  name: z.string().trim().min(1).max(LIMITS.name),
  homeTitle: optionalText(LIMITS.homeTitle),
  description: optionalText(LIMITS.description),
  contacts: z.object({
    phone: optionalText(LIMITS.phone),
    email: z
      .union([z.literal(''), z.email().max(LIMITS.email)])
      .nullable()
      .transform((v) => (v === '' ? null : v)),
    address: optionalText(LIMITS.address),
    hours: optionalText(LIMITS.hours),
  }),
  // Референс сховища, не URL; чи це справді логотип — перевіряє операція в БД.
  logo: z.string().min(1).max(200).nullable(),
  socials: z
    .array(z.object({ network: z.enum(SOCIAL_NETWORKS), url: socialUrl }))
    .max(LIMITS.socials),
});

export type StoreProfileInput = z.input<typeof storeProfileInput>;
