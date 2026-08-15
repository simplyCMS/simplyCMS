/**
 * SolarStore Theme — синя палітра для магазину альтернативної енергетики.
 *
 * Контракт v2: тема постачає лише паспорт, токени і компоненти. Сторінки,
 * каркаси і канонічні секції головної — у ядрі. Власний hero тема задає
 * явно (`HeroBanner`), бо він статичний і не є слайдером банерів.
 */
import type { ThemeModule } from '@simplycms/themes/types';
import manifest from './manifest';
import { tokens } from './tokens';
import { messages } from './messages';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HeroBanner } from './components/HeroBanner';
import { HomeSections } from './components/HomeSections';

const theme: ThemeModule = {
  manifest,
  tokens,
  components: {
    Header,
    Footer,
    HeroBanner,
    HomeSections,
  },
  messages,
  // Контракт v2.2 (Р8): демонстрація fonts-контуру — Google Fonts-джерело
  // того самого Inter, нуль візуальних змін (доводиться Step 4).
  fonts: [
    {
      stylesheet:
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },
  ],
};

export default theme;
