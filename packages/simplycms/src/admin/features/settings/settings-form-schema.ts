import { z } from 'zod';
import {
  SOCIAL_NETWORKS,
  STORE_PROFILE_LIMITS as LIMITS,
  type StoreProfile,
} from 'simplycms/contracts/store-profile';

/**
 * Клієнтська схема форми профілю магазину (Е6б, Task 6). Межі — з
 * `STORE_PROFILE_LIMITS` (T0), ті самі, що перевіряє сервер: розбіжність
 * дала б форму, яка пропускає те, що сервер відбиває 400-ю. Поля форми —
 * рядки (порожній рядок = «не задано»); у `StoreProfile` вони йдуть як
 * `null` через `toProfile`.
 */
const text = (max: number) => z.string().trim().max(max);

export const storeProfileFormSchema = z.object({
  name: z.string().trim().min(1).max(LIMITS.name),
  homeTitle: text(LIMITS.homeTitle),
  description: text(LIMITS.description),
  phone: text(LIMITS.phone),
  email: z
    .string()
    .trim()
    .pipe(z.union([z.literal(''), z.email().max(LIMITS.email)])),
  address: text(LIMITS.address),
  hours: text(LIMITS.hours),
  logo: z.string().nullable(),
  socials: z
    .array(
      z.object({
        network: z.enum(SOCIAL_NETWORKS),
        // `z.url()` пропускає `http:` і `javascript:` — схему перевіряємо
        // прямо, як і сервер (href з `javascript:` — XSS).
        url: z
          .string()
          .trim()
          .max(LIMITS.socialUrl)
          .refine((v) => z.url().safeParse(v).success)
          .refine((v) => v.startsWith('https://')),
      }),
    )
    .max(LIMITS.socials),
});

export type StoreProfileFormValues = z.infer<typeof storeProfileFormSchema>;

/** Профіль із сервера → значення форми (`null` → порожній рядок). */
export function fromProfile(p: StoreProfile): StoreProfileFormValues {
  return {
    name: p.name,
    homeTitle: p.homeTitle ?? '',
    description: p.description ?? '',
    phone: p.contacts.phone ?? '',
    email: p.contacts.email ?? '',
    address: p.contacts.address ?? '',
    hours: p.contacts.hours ?? '',
    logo: p.logo,
    socials: p.socials.map((s) => ({ ...s })),
  };
}

/** Значення форми → тіло `saveStoreProfile`; порожній рядок → `null`. */
export function toProfile(v: StoreProfileFormValues): StoreProfile {
  const orNull = (s: string) => (s === '' ? null : s);
  return {
    name: v.name,
    homeTitle: orNull(v.homeTitle),
    description: orNull(v.description),
    contacts: {
      phone: orNull(v.phone),
      email: orNull(v.email),
      address: orNull(v.address),
      hours: orNull(v.hours),
    },
    // Референс, не URL: `logo` лягає як є (Е6б-14).
    logo: v.logo,
    socials: v.socials,
  };
}
