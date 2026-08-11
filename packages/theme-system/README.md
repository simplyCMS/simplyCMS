# @simplycms/themes

Система тем SimplyCMS (контракт v2): реєстр тем із lazy-лоадерами, SSR-резолв
активної теми з БД, валідатор модуля теми і рендер її токенів у CSS-змінні.
Тема постачає **лише оформлення** — маніфест, токени, `Header`/`Footer` та,
опційно, власний каталог перекладів (`messages`); сторінки й каркаси
лишаються в ядрі (`theme.pages` більше не існує).

Пакет ядра [SimplyCMS](https://github.com/simplyCMS/simplyCMS) — відкритої
e-commerce CMS на TanStack Start + Supabase. Окремо ставити зазвичай не треба:
магазин створюється скаффолдером `pnpm create simplycms-store`, який приводить
усе ядро разом.

## Встановлення

```bash
pnpm add @simplycms/themes
```

## Що всередині

| Імпорт                                  | Що дає                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| `@simplycms/themes`                     | Барель: усе нижче + `getActiveThemeSSR()` — активна тема з таблиці `themes`      |
| `@simplycms/themes/ThemeRegistry`       | Singleton `ThemeRegistry` (`register`/`has`/`load`/`clearCache`), `ThemeLoader`  |
| `@simplycms/themes/ThemeContext`        | `ThemeProvider`, `useTheme()`, `useThemeSettings(key)`                           |
| `@simplycms/themes/applyTokens`         | `applyTokens(tokens)` → CSS `:root { … }` (+ `.dark { … }`) для інлайн-`<style>`  |
| `@simplycms/themes/validateThemeModule` | `validateThemeModule(m)` — assert-валідатор контракту v2                         |
| `@simplycms/themes/useThemeT`           | `useThemeT<K>()` — транслятор власного каталогу теми (`ThemeModule.messages`)    |
| `@simplycms/themes/types`               | `ThemeModule`, `ThemeManifest`, `DesignTokens`, `ThemeComponents`, `ThemeMessages`, `ThemeRecord`, `ActiveThemeSSR` |

Токени пишуться в **наявні** semantic-змінні shadcn (`--primary`, `--radius`, …);
тема не везе власного CSS-файлу.

## Приклад

```ts
// themes/default/index.ts — модуль теми
import type { ThemeModule } from '@simplycms/themes/types';
import manifest from './manifest';
import { tokens } from './tokens';
import { Header } from './components/Header';
import { Footer } from './components/Footer';

const theme: ThemeModule = { manifest, tokens, components: { Header, Footer } };
export default theme;

// src/theme-registry.ts — ізоморфна side-effect-реєстрація з конфіга магазину
import { ThemeRegistry } from '@simplycms/themes/ThemeRegistry';
import config from '../simplycms.config';

for (const [name, loader] of Object.entries(config.themes ?? {})) {
  if (!ThemeRegistry.has(name)) ThemeRegistry.register(name, loader);
}
```

## Переклади теми (`ThemeModule.messages`)

Тема може постачати ВЛАСНИЙ каталог перекладів — опційне поле, ключі якого
живуть в окремому просторі від `MessageKey` ядра (`@simplycms/i18n`). Ядровий
`MessageKey` лишається замкненим union-ом: розширювати його ключами тем не
можна, це вбило б захист від одруків для всіх core-ключів.

```ts
// themes/default/messages.ts
export const messages = {
  uk: { 'theme.footer.returns': 'Повернення' },
  en: { 'theme.footer.returns': 'Returns' },
} as const;

// Власний union ключів — перевірка одруків у межах ЦІЄЇ теми
export type DefaultThemeKey = keyof typeof messages.uk;
```

```tsx
// themes/default/components/Footer.tsx
import { useThemeT } from '@simplycms/themes/useThemeT';
import type { DefaultThemeKey } from '../messages';

const t = useThemeT<DefaultThemeKey>();
t('theme.footer.returns');
```

Ланцюжок fallback — `messages[locale][key] → messages['uk'][key] → сам key`
(як і в core-транслятора `createTranslator`). Текст, що ЗБІГАЄТЬСЯ з наявним
core-ключем (`catalog.title`, `cart.title`, `nav.orders`, …), компонент бере
через `useT()` з `@simplycms/i18n` напряму — дублювати такий рядок у
`messages` теми не треба. Поле опційне: тема без нього лишається валідною
(`validateThemeModule` вимагає перевірки форми лише за наявності `messages`).

## 🔴 `ThemeRegistry.load()` віддає кешовану проміс-референцію

Це навмисно **не** `async`-функція: React `use(ThemeRegistry.load(name))` вимагає
стабільний проміс між рендерами, а обгортка у власний `async` створювала б новий
проміс щорендеру — uncached promise і нескінченний suspend.

## Ліцензія

MIT
