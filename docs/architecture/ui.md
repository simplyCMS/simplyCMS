# UI: дизайн-система, компоненти, редактор

Правила побудови UI вітрини й адмінки. Контракт тем, `views`, слоти реквізитів,
токени й шрифти — `docs/architecture/themes.md` (там же чекліст автора теми);
тут лише те, що стосується компонентів ядра.

## 1. Дизайн-система `simplycms/ui`

- Примітиви на базі **shadcn/ui** + Radix (T3, self-contained: не залежить від
  `core`). Стилі — **Tailwind v4** + `class-variance-authority`; злиття класів — `cn()`
  із `simplycms/ui/utils`. Конфігурація — `tailwind.config.ts`, entry —
  `src/styles/globals.css` (`@import` + `@config`).
- Використовуй компоненти `simplycms/ui`, не дублюй їх у host-`src/` чи в темах.
- Бізнес-компоненти вітрини — у feature-UI теках ядра: `simplycms/{catalog,cart,checkout,profile,reviews}-ui`.
  Реекспортів через `simplycms/core` немає (фасадну роль розчинено), імпортуй із
  джерела. Theme-specific компоненти (Header, Footer, HeroBanner, HomeSections,
  `views`) — лише в темі.
- Новий shadcn-компонент: спершу перевір через shadcn MCP/скіл `shadcn` (реєстр →
  приклади → аудит після додавання), додавай у `packages/simplycms/src/ui/`.
- Стилізація: Tailwind-класи й CSS-змінні теми; кольори не хардкодяться, inline-стилі —
  лише для значень, які неможливо виразити класом (динамічні розміри/позиції).
  У core-компонентах вітрини шрифти не хардкодяться: заголовки беруть `font-heading`,
  решта — `font-sans` (у темах вибір шрифту утиліт-класами законний).
- Mobile-first, dark mode через `next-themes` + CSS-змінні.
- Доступні імена контролів: `jsx-a11y/label-has-associated-control` (error) у п'яти теках
  воронки. Лінт бачить лише `<label>` — контрол без лейбла йому невидимий, тож зелений
  лінт повноти доступності не доводить.

## 2. Теми: що тема не робить

Тема постачає токени, `components` і (опційно) `views`; **не** постачає даних,
роутів, SEO, сторінок і лейаутів (`theme.pages`, `MainLayout`, `CatalogLayout`,
`ProfileLayout` видалені свідомо, і не повертаються). Логіки в темі немає. Каркаси
`StorefrontShell`/`ProtectedShell` обгортають канонічну сторінку; view — чиста
функція від view-model-а. Деталі — `themes.md` §2.

## 3. Rich text (Tiptap v3)

- Редактор адмінки — `RichTextEditor` (`simplycms/admin/components/RichTextEditor.tsx`),
  форми відгуків — `ReviewRichTextEditor` (`simplycms/reviews-ui`). Нові обгортки не
  створюй — використовуй існуючі; нове розширення додавай через `@tiptap/*` пакети
  після звірки API (context7).
- Набір розширень у `RichTextEditor`: StarterKit + Image + TextAlign.
- 🔴 **Контент зберігається як HTML-рядок** (`editor.getHTML()` → колонка), не як
  Tiptap JSON. Санітизація — на сервері двома рубежами (запис і віддача), контракт —
  `data-layer.md` §9; тут — що це означає для UI:
  - у DOM розмітку контенту вставляє **лише** `<RichHtml html={…}/>`
    (`simplycms/ui/rich-html`) — єдине місце з `dangerouslySetInnerHTML` для контенту;
    проп `html` типу `SanitizedHtml` (брендований `string`, T0 `simplycms/contracts`),
    сирий `string` компілятор відхилить; опційні `className` і `as`
    (`div | section | article | span`);
  - `dangerouslySetInnerHTML` деінде забороняє правило
    `simplycms-rich-html/no-dangerously-set-inner-html` (виняток — явний список із
    причинами в `eslint.config.mjs`: `ThemeTokens`, `ui/chart`, інлайн-скрипти
    `__root.tsx`);
  - білі списки санітизатора **збігаються з виводом редакторів**: набори розширень
    винесено в `admin/components/rich-text-extensions.ts` і
    `reviews-ui/review-editor-extensions.ts`, а `tests/rich-html-roundtrip.test.ts`
    генерує HTML справжніми редакторами й вимагає, щоб він пройшов санітизацію без
    змін. 🔴 Нова можливість редактора (тег, атрибут, клас) = правка набору
    розширень **і** профілю в `simplycms/sanitize`; без другого форматування
    мовчки зникне на вітрині, а тест червоніє.
- Редактор рендериться лише на клієнті (`useEditor` — браузерний API).
