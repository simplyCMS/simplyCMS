import { describe, expect, it } from 'vitest';
import {
  EMPTY_STORE_PROFILE,
  parseStoreProfile,
} from 'simplycms/domain/store-profile';
import type { StoreProfile } from 'simplycms/contracts/store-profile';

describe('parseStoreProfile', () => {
  it('null, {} і рядок → EMPTY_STORE_PROFILE, без throw', () => {
    for (const raw of [null, {}, 'x', 42, []]) {
      expect(parseStoreProfile(raw)).toEqual(EMPTY_STORE_PROFILE);
    }
  });

  it('невалідні типи полів → дефолти поля, валідні збережено', () => {
    expect(
      parseStoreProfile({ name: 42, description: 'Опис', socials: 'x' }),
    ).toEqual({ ...EMPTY_STORE_PROFILE, description: 'Опис' });
  });

  it('socials: невідома мережа, http: і javascript: відкинуто; понад 10 — обрізано', () => {
    const ok = { network: 'telegram', url: 'https://t.me/shop' };
    const raw = {
      name: 'A',
      socials: [
        ok,
        { network: 'myspace', url: 'https://x' },
        { network: 'x', url: 'http://x.com' },
        { network: 'x', url: 'javascript:alert(1)' },
        ...Array(12).fill(ok),
      ],
    };
    const { socials } = parseStoreProfile(raw);
    expect(socials).toHaveLength(10);
    expect(socials.every((s) => s.url.startsWith('https://'))).toBe(true);
  });

  it('повний валідний профіль — тотожність', () => {
    const full: StoreProfile = {
      name: 'Магазин',
      homeTitle: 'Головна',
      description: 'Опис',
      contacts: {
        phone: '+380501112233',
        email: 'a@b.ua',
        address: 'Київ',
        hours: 'Пн–Пт 9–18',
      },
      logo: 'store_logo/abc.png',
      socials: [{ network: 'instagram', url: 'https://instagram.com/shop' }],
    };
    expect(parseStoreProfile(full)).toEqual(full);
  });

  it('надто довге поле обрізається, порожній рядок → null', () => {
    const p = parseStoreProfile({ name: 'a'.repeat(500), homeTitle: '  ' });
    expect(p.name).toHaveLength(120);
    expect(p.homeTitle).toBeNull();
  });

  it('повертає свіжий обʼєкт: мутація не псує EMPTY_STORE_PROFILE', () => {
    parseStoreProfile(null).socials.push({
      network: 'x',
      url: 'https://x.com',
    });
    expect(EMPTY_STORE_PROFILE.socials).toEqual([]);
  });
});
