/**
 * Тема «__THEME_DISPLAY_NAME__», скаффолджена `simplycms create theme`.
 *
 * Контракт v2: тема постачає ЛИШЕ паспорт, токени і компоненти оформлення.
 * Сторінок і лейаутів у ній немає — вони живуть у ядрі
 * (`@simplycms/storefront-routes`), а каркас бере з теми Header/Footer.
 *
 * `HeroBanner` і `HomeSections` не задані навмисно: без них ядро рендерить
 * власні канонічні секції головної. Додай їх у `components`, коли головна
 * має виглядати інакше.
 */
import type { ThemeModule } from '@simplycms/themes/types';
import manifest from './manifest';
import { tokens } from './tokens';
import { messages } from './messages';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
// Контракт v3 (опційно) — див. коментар нижче й `views/Cart.tsx`:
// import { CartView } from './views/Cart';

const theme: ThemeModule = {
  manifest,
  tokens,
  components: {
    Header,
    Footer,
  },
  messages,
  // Контракт v2.2: опційні зовнішні font stylesheet-и (напр. Google Fonts).
  // Лише абсолютні `https:`-URL — розкоментуй і додай свій:
  // fonts: [
  //   { stylesheet: 'https://fonts.googleapis.com/css2?family=Manrope&display=swap' },
  // ],
  //
  // Контракт v3: `views` перевизначає ВЕСЬ view-шар канонічної сторінки
  // вітрини (`Home` | `Catalog` | `CatalogSection` | `ProductDetail` | `Cart`).
  // Дані, SEO і логіка лишаються в ядрі — тема отримує готовий view-model і
  // РОЗСТАВЛЯЄ його слоти (комерційні реквізити), а не переписує їх.
  //
  // Готовий приклад — `views/Cart.tsx` у цій же теці (окремий `.tsx`-модуль:
  // JSX у `.ts`-файлі не збирається). Щоб увімкнути, розкоментуй імпорт
  // `CartView` угорі файла і рядок нижче:
  //
  // views: { Cart: CartView },
  //
  // 🔴 Заявлений view мусить пройти conformance — інакше магазин просто
  // втратить кнопку купівлі: `pnpm simplycms theme:conformance __THEME_NAME__`.
};

export default theme;
