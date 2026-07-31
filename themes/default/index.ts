/**
 * Default Theme — тепла бежева палітра з кораловим акцентом.
 *
 * Контракт v2: тема постачає лише паспорт, токени і компоненти. Сторінки,
 * каркаси (Header/Footer-обгортка, профіль) і канонічні секції головної —
 * у ядрі.
 *
 * `HeroBanner` навмисно НЕ заданий: ядро підставляє власний `BannerSlider`,
 * тобто рівно те, що тема рендерила раніше. Задавати його тут означало б
 * імпортувати компонент route-пакета в тему — зайва інверсія залежності.
 */
import type { ThemeModule } from "@simplycms/themes/types";
import manifest from "./manifest";
import { tokens } from "./tokens";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { HomeSections } from "./components/HomeSections";

const theme: ThemeModule = {
  manifest,
  tokens,
  components: {
    Header,
    Footer,
    HomeSections,
  },
};

export default theme;
