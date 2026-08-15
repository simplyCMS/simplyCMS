# simplycms-theme-deo

Тема SimplyCMS, скаффолджена `simplycms create theme`.

Живе в теці `themes/deo` магазину — аліас `@themes/*` і
Tailwind-глоб `./themes/**/*.{ts,tsx}` уже налаштовані, окремий build не
потрібен: правки видно після перезапуску `pnpm dev` (набір тем — build-time).

Щоб тема стала активною, увімкни її в адмінці: `/admin/themes` → «Активувати».
Рядок у таблиці `themes` заводить `bootstrapThemes` при першому заході адміна.

## Контракт v2 (що тема постачає)

- **`manifest.ts`** — паспорт: `name` (ЗБІГАЄТЬСЯ з ключем у
  `simplycms.config.ts`), `displayName`, `version`, `engines.simplycms`.
- **`tokens.ts`** — значення наявних semantic-змінних shadcn; розкладає їх
  `applyTokens`, власного CSS тема не везе.
- **`components/`** — `Header` і `Footer` обовʼязкові (їх рендерять каркаси
  ядра). Опційні `HeroBanner` і `HomeSections` — точки розширення головної;
  поки не задані, ядро рендерить власні канонічні секції.
- **`messages.ts`** — власний каталог теми (`useThemeT`), `en` дзеркалить
  `uk`. Core-ключі (`catalog.title`, `cart.title`, …) беруться `useT()`
  напряму — дублювати їх у каталозі теми не треба.

Сторінок і лейаутів тема НЕ постачає: вони канонічні
(`@simplycms/storefront-routes`).

## Що далі

- **Оформлення** — правь `tokens.ts`; для темного режиму — блок `dark`.
- **Типографіка (v2.2)** — опційні токени `'font-sans'`/`'font-heading'` у
  `tokens.ts` (повний CSS font-family stack рядком) і опційний `fonts` у
  `index.ts` (масив зовнішніх `https:`-stylesheet, напр. Google Fonts) —
  обидва закоментовані приклади в шаблоні. Без них магазин лишається на
  host-Inter (fallback у `globals.css`).
- **Дані на головній** — додай `HomeSections`: компонент рендериться після
  канонічних секцій і пропсів не отримує, дані тягне сам (хуки / TanStack
  Query).
- **Налаштування теми** — `settings` у `ThemeModule`; форму рендерить
  адмінка, значення читай `useThemeSettings`.
- **Публікація** — щоб віддати тему іншим магазинам, зроби з теки пакет за
  конвенцією `simplycms-theme-<name>` (або `@vendor/simplycms-theme-<name>`),
  винеси код у `src/`, залиш `src` у `files` і оголоси `@simplycms/*` як
  **peerDependencies**. Установка в чужому магазині —
  `simplycms add <pkg> --theme` (npm) або `--theme --copy` (copy-in).
