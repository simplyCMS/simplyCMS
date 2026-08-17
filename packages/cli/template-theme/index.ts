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
};

export default theme;
