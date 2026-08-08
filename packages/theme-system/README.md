# @simplycms/themes

Система тем SimplyCMS (контракт v2): реєстр тем із lazy-лоадерами, SSR-резолв
активної теми з БД, валідатор модуля теми і рендер її токенів у CSS-змінні.
Тема постачає **лише оформлення** — маніфест, токени та `Header`/`Footer`;
сторінки й каркаси лишаються в ядрі (`theme.pages` більше не існує).

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
| `@simplycms/themes/types`               | `ThemeModule`, `ThemeManifest`, `DesignTokens`, `ThemeComponents`, `ThemeRecord`, `ActiveThemeSSR` |

Токени пишуться в **наявні** semantic-змінні shadcn (`--primary`, `--background`,
`--radius`, …) — тема не везе власного CSS-файлу.

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

## 🔴 `ThemeRegistry.load()` віддає кешовану проміс-референцію

Це навмисно **не** `async`-функція: React `use(ThemeRegistry.load(name))` вимагає
стабільний проміс між рендерами, а обгортка у власний `async` створювала б новий
проміс щорендеру — uncached promise і нескінченний suspend. Незареєстрована тема
сторінку не валить: реєстр падає на `default`.

## Ліцензія

MIT
