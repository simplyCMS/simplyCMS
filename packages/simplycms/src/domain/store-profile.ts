// Розбір профілю магазину з `system_settings['store_profile']` (Е6б-6).
// Ручний type-guard без Zod (T1 не тягне Zod; прецедент `parseShippingSnapshot`).
// 🔴 Поблажливий навмисно: зіпсований рядок (ручний SQL, старий дамп) не має
// класти вітрину 500-ю, а форма адмінки має відкритись і дати його полагодити.
// Суворість живе лише на записі (`admin-server`).

import {
  SOCIAL_NETWORKS,
  STORE_PROFILE_LIMITS as LIMITS,
  type SocialNetwork,
  type StoreProfile,
} from 'simplycms/contracts/store-profile';

export const EMPTY_STORE_PROFILE: StoreProfile = {
  name: '',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logo: null,
  socials: [],
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Не-рядок і порожній рядок → `null`; надто довгий обрізається, а не губиться. */
function text(x: unknown, max: number): string | null {
  if (typeof x !== 'string') return null;
  const t = x.trim();
  return t === '' ? null : t.slice(0, max);
}

function isNetwork(x: unknown): x is SocialNetwork {
  return (
    typeof x === 'string' && (SOCIAL_NETWORKS as readonly string[]).includes(x)
  );
}

function parseSocials(x: unknown): StoreProfile['socials'] {
  if (!Array.isArray(x)) return [];
  const out: StoreProfile['socials'] = [];
  for (const item of x) {
    if (!isRecord(item) || !isNetwork(item.network)) continue;
    const url = item.url;
    // Лише `https:`: `http:`/`javascript:` у href вітрини — вектор XSS.
    if (typeof url !== 'string' || url.length > LIMITS.socialUrl) continue;
    if (!url.startsWith('https://')) continue;
    out.push({ network: item.network, url });
    if (out.length === LIMITS.socials) break;
  }
  return out;
}

/** Ніколи не кидає й не повертає `null`: невалідне поле стає дефолтом. */
export function parseStoreProfile(json: unknown): StoreProfile {
  if (!isRecord(json))
    return {
      ...EMPTY_STORE_PROFILE,
      contacts: { ...EMPTY_STORE_PROFILE.contacts },
      socials: [],
    };
  const c = isRecord(json.contacts) ? json.contacts : {};
  return {
    name: text(json.name, LIMITS.name) ?? '',
    homeTitle: text(json.homeTitle, LIMITS.homeTitle),
    description: text(json.description, LIMITS.description),
    contacts: {
      phone: text(c.phone, LIMITS.phone),
      email: text(c.email, LIMITS.email),
      address: text(c.address, LIMITS.address),
      hours: text(c.hours, LIMITS.hours),
    },
    logo: typeof json.logo === 'string' && json.logo !== '' ? json.logo : null,
    socials: parseSocials(json.socials),
  };
}
