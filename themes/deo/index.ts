/**
 * Тема «Deo», скаффолджена `simplycms create theme`.
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
