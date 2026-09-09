# themes/default — дефолтна тема SimplyCMS

Світлий монохром із латунним акцентом і гарнітурою Geist. Дизайн знято з
референс-сайту механізмом `redesign-from-reference` (лайв-тест 2026-08-15/16)
і з 2026-08-17 замінив попередню бежеву default-тему — рішення власника.

Живе в теці `themes/default` магазину — аліас `@themes/*` і
Tailwind-глоб `./themes/**/*.{ts,tsx}` уже налаштовані, окремий build не
потрібен: правки видно після перезапуску `pnpm dev` (набір тем — build-time).

Це тема-fallback платформи: `ThemeRegistry.load` падає на неї, коли
запитаної теми немає, тож видаляти або перейменовувати її не можна.

## Контракт v2 (що тема постачає)

- **`manifest.ts`** — паспорт: `name` (ЗБІГАЄТЬСЯ з ключем у
  `simplycms.config.ts`), `displayName`, `version`, `engines.simplycms`.
- **`tokens.ts`** — значення наявних semantic-змінних shadcn; розкладає їх
  `applyTokens`, власного CSS тема не везе. Джерело значень — виміри
  інспекцій референсу (локальні артефакти `docs/design-references/`,
  поза git), включно з типографічними токенами v2.2
  (`'font-sans'`/`'font-heading'` — Geist).
- **`index.ts`** — збірка `ThemeModule` + `fonts` (Google Fonts stylesheet
  Geist / Geist Mono з кириличними підмножинами; контракт v2.2 — лише
  зовнішні `https:`-stylesheet-и).
- **`components/`** — `Header` і `Footer` обовʼязкові (їх рендерять каркаси
  ядра); `HeroBanner` і `HomeSections` — оформлення головної. Спека кожного
  компонента — локальний артефакт інспекції (поза git).
- **`messages.ts`** — власний каталог теми (`useThemeT`), `en` дзеркалить
  `uk`. Core-ключі (`catalog.title`, `cart.title`, …) беруться `useT()`
  напряму — дублювати їх у каталозі теми не треба. 🔴 `theme.brand` — назва
  ВАШОГО магазину; міняється тут, без правок компонентів.

Сторінок і лейаутів тема НЕ постачає: вони канонічні
(`simplycms/storefront-routes`).

## Що далі

- **Оформлення** — правь `tokens.ts`; для темного режиму — блок `dark`
  (зараз його немає свідомо: референс світлий).
- **Дані на головній** — `HomeSections` рендериться після канонічних секцій
  і пропсів не отримує, дані тягне сам (хуки / TanStack Query).
- **Налаштування теми** — `settings` у `ThemeModule`; форму рендерить
  адмінка.
- **Публікація** — щоб віддати тему іншим магазинам, зроби з теки пакет за
  конвенцією `simplycms-theme-<name>` (або `@vendor/simplycms-theme-<name>`),
  винеси код у `src/`, залиш `src` у `files` і оголоси `simplycms` як
  **peerDependency**. Установка в чужому магазині —
  `simplycms add <pkg> --theme` (npm) або `--theme --copy` (copy-in).
