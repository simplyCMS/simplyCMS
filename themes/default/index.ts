/**
 * Default-тема — світлий монохром із латунним акцентом.
 *
 * Дизайн знято з референсу механізмом redesign-from-reference (лайв-тест
 * 2026-08-15/16); з 2026-08-17 це ДЕФОЛТНА тема платформи — рішення
 * власника, попередню бежеву default-тему замінено цілком.
 *
 * Контракт v2: тема постачає ЛИШЕ паспорт, токени і компоненти оформлення.
 * Сторінок і лейаутів у ній немає — вони живуть у ядрі
 * (`simplycms/storefront-routes`), а каркас бере з теми Header/Footer.
 *
 * Задані всі чотири слоти: `Header`/`Footer` (обовʼязкові каркасу) плюс
 * `HeroBanner` і `HomeSections` — тема бере на себе оформлення головної.
 * Спеки компонентів — локальні артефакти інспекцій
 * (`docs/design-references/`, поза git з 2026-08-17).
 */
import type { ThemeModule } from 'simplycms/themes/types';
import manifest from './manifest';
import { tokens } from './tokens';
import { messages } from './messages';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HeroBanner } from './components/HeroBanner';
import { HomeSections } from './components/HomeSections';
import { CatalogView } from './views/CatalogView';
import { CatalogSectionView } from './views/CatalogSectionView';
import { ProductDetailView } from './views/ProductDetailView';

const theme: ThemeModule = {
  manifest,
  tokens,
  components: {
    Header,
    Footer,
    HeroBanner,
    HomeSections,
  },
  // Контракт v3: власний view-шар трьох сторінок вітрини. Сторінка, ключа
  // якої тут немає (`Home`, `Cart`), лишається канонічною — перевизначення
  // посторінкове й цілісне. Дані, роути й SEO лишаються за ядром: view —
  // чиста функція від view-model-а, а комерційні реквізити тема лише
  // РОЗСТАВЛЯЄ (`vm.slots`). Гейт заявленого набору:
  //   pnpm simplycms theme:conformance default
  // (другий канал — `themes/default/conformance.test.tsx`, їде в `pnpm test`).
  views: {
    Catalog: CatalogView,
    CatalogSection: CatalogSectionView,
    ProductDetail: ProductDetailView,
  },
  messages,
  // Контракт v2.2: лише абсолютні `https:`-stylesheet-и. Референс роздає
  // Geist власними Next.js-чанками (self-hosted `@font-face`) — тягнути його
  // ассети заборонено правовими межами й технічно неможливо цим контрактом.
  // Geist і Geist Mono відкриті (Vercel, OFL) і є на Google Fonts, причому з
  // кириличними підмножинами — критично для українського інтерфейсу.
  fonts: [
    {
      stylesheet:
        'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap',
    },
  ],
};

export default theme;
