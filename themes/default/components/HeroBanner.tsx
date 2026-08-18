import { Link } from '@tanstack/react-router';
import { ArrowRight, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import type { Banner } from '@simplycms/objects/objects';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { MONO_STACK } from './mono';
import type { ThemeKey } from '../messages';

const TRUST = [
  {
    icon: ShieldCheck,
    titleKey: 'theme.hero.trustAuthentic',
    noteKey: 'theme.hero.trustAuthenticNote',
  },
  {
    icon: RotateCcw,
    titleKey: 'theme.hero.trustReturns',
    noteKey: 'theme.hero.trustReturnsNote',
  },
  {
    icon: Truck,
    titleKey: 'theme.hero.trustShipping',
    noteKey: 'theme.hero.trustShippingNote',
  },
] as const satisfies ReadonlyArray<{
  icon: typeof Truck;
  titleKey: ThemeKey;
  noteKey: ThemeKey;
}>;

const CTA_BASE =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

/**
 * HeroBanner default-теми — спека: локальний артефакт
 * `docs/design-references/…/components/HeroBanner.spec.md` (поза git).
 *
 * Модель взаємодії — static: жодного слайдера, автопрокрутки чи паралаксу
 * (hero референсу виміряно як фіксований блок). Ядро дає `banners`, і ми
 * беремо звідти ЛИШЕ зображення — тексти йдуть з каталогу теми.
 *
 * 🔴 Фото — виключно з нашої БД. Чужа картинка з референсу тут не зʼявиться
 * за жодних умов.
 *
 * 🔴 Empty-стан (саме так на цьому стенді — банерів у сіді немає):
 * декоративна підложка НЕ рендериться зовсім, а сітка стає одноколонковою.
 * Рішення власника за підсумком фази 5 прогону №2: порожній білий круг на
 * пів-екрана читався як недовантажене зображення, а не як оформлення.
 * Поведінка З банером — незмінна (дві колонки, фото в круглій підложці).
 */
export function HeroBanner({ banners = [] }: { banners?: Banner[] }) {
  const tt = useThemeT<ThemeKey>();
  const banner = banners.find(
    (item) => item.desktop_image_url || item.image_url,
  );
  const image = banner?.desktop_image_url || banner?.image_url || null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:py-20">
      <div
        className={`grid items-center gap-10 ${image ? 'md:grid-cols-2' : ''}`}
      >
        <div>
          <span
            className="inline-flex items-center rounded-full border border-border/80 bg-card/80 px-4 py-2 text-[13px] font-medium text-foreground"
            style={{ fontFamily: MONO_STACK }}
          >
            {tt('theme.hero.badge')}
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.025em] text-foreground md:text-5xl lg:text-[64px]">
            {tt('theme.hero.titleLine1')}
            <br />
            {tt('theme.hero.titleLine2')}
          </h1>

          <p className="mt-6 max-w-[448px] text-[17px] leading-[1.625] text-muted-foreground">
            {tt('theme.hero.subtitle')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/catalog"
              className={`${CTA_BASE} bg-primary text-primary-foreground hover:opacity-90`}
            >
              {tt('theme.hero.ctaPrimary')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/catalog"
              className={`${CTA_BASE} border border-border bg-card text-foreground hover:bg-muted`}
            >
              {tt('theme.hero.ctaSecondary')}
            </Link>
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:gap-8">
            {TRUST.map((item) => (
              <div key={item.titleKey} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 shrink-0 text-foreground" />
                <div>
                  <div className="text-[13px] font-medium text-foreground">
                    {tt(item.titleKey)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {tt(item.noteKey)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🔴 Підложка існує ЛИШЕ разом із фото (empty-стан — див. шапку).
            Колір — `card` (біла) з рамкою, а НЕ `muted`: на полотні #f5f5f5
            сірий #f3f4f6 дає контраст 1.02:1 і зникає зовсім (спіймано на
            власному скріншоті фази 5 прогону №1). */}
        {image && (
          <div className="flex justify-center md:justify-end">
            <div className="flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-full border border-border bg-card md:max-w-[440px]">
              <img
                src={image}
                alt={banner?.title ?? ''}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
