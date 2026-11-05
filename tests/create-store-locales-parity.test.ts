import { listLanguagePacks } from 'simplycms/i18n/packs';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES } from '../packages/create-simplycms-store/src/locales.mjs';

// Скаффолдер не залежить від ядра, тож перелік мов тримається вручну; цей тест —
// єдина гарантія, що він не розійдеться з мовними пакетами платформи.
describe('create-simplycms-store: SUPPORTED_LOCALES', () => {
  it('збігається з кодами мовних пакетів ядра', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(
      listLanguagePacks()
        .map((pack) => pack.code)
        .sort(),
    );
  });
});
