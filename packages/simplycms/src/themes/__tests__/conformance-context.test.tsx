// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { CartViewModel } from 'simplycms/contracts/views';
import { STORE_PROFILE_FIXTURE } from 'simplycms/contracts/views/fixtures';
import { assertThemeViewsConformance } from '../conformance';
import { useStoreProfile } from '../store-profile';
import { useThemeSettings } from '../theme-context';
import { useThemeT } from '../useThemeT';
import { makeTheme } from './conformance-themes';

/**
 * Render-контекст, який kit гарантує view теми (спека §7 п.3, §8 п.3):
 * i18n + налаштування з DEFAULT-ами схеми теми, БЕЗ БД.
 *
 * 🔴 Твердження перевіряються зсередини самого view: він кидає виняток, якщо
 * значення не те, якого чекає. Інакше «зелений assert» не відрізнити від
 * «kit просто нічого не читав» — та сама логіка, що й у решті негативного
 * контролю Р8.
 */
const settingsSchema = {
  accent: { type: 'color', default: '#ff0000', label: 'Accent' },
} as const;

function SettingsAwareCart({ slots }: CartViewModel) {
  const accent = useThemeSettings<string>('accent');
  if (accent !== '#ff0000') {
    throw new Error(`settings default not applied: ${String(accent)}`);
  }

  return (
    <div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}

function TranslatedCart({ slots }: CartViewModel) {
  const t = useThemeT();
  if (t('cart.headline') !== 'Ваш кошик') {
    throw new Error(`theme catalog not resolved: ${t('cart.headline')}`);
  }

  return (
    <div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}

function MissingSettingCart({ slots }: CartViewModel) {
  const accent = useThemeSettings<string>('accent');
  if (accent !== '#ff0000') {
    throw new Error('settings default not applied');
  }

  return (
    <div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}

function ProfileAwareCart({ slots }: CartViewModel) {
  const profile = useStoreProfile();
  if (profile !== STORE_PROFILE_FIXTURE) {
    throw new Error(`fixture profile not provided: ${profile.name}`);
  }

  return (
    <div>
      <slots.Items />
      <slots.Summary />
      <slots.Checkout />
    </div>
  );
}

describe('assertThemeViewsConformance — render-контекст', () => {
  it('view бачить профіль магазину з фікстури (Е6б-20)', async () => {
    const theme = makeTheme({ Cart: ProfileAwareCart });

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual(['Cart']);
  });

  it('view бачить default-и зі схеми settings — без БД', async () => {
    const theme = makeTheme(
      { Cart: SettingsAwareCart },
      { settings: { ...settingsSchema } },
    );

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual(['Cart']);
  });

  it('без схеми settings той самий view червоніє — доказ, що читання справжнє', async () => {
    const theme = makeTheme({ Cart: MissingSettingCart });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /settings default not applied/,
    );
  });

  it('view читає власний каталог теми через useThemeT', async () => {
    const theme = makeTheme(
      { Cart: TranslatedCart },
      { messages: { uk: { 'cart.headline': 'Ваш кошик' } } },
    );

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual(['Cart']);
  });
});
