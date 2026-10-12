import { Link } from '@tanstack/react-router';
import { ArrowRight, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import type { Banner } from 'simplycms/contracts/objects';
import { pickHeroBanner, pickHeroImage } from 'simplycms/domain';
import { useThemeT } from 'simplycms/themes/useThemeT';
import { MONO_STACK } from './mono';
import { ALIGN, BannerCta, CTA_BASE } from './HeroBannerParts';
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

/**
 * HeroBanner default-теми — спека: локальний артефакт
 * `docs/design-references/…/components/HeroBanner.spec.md` (поза git).
 *
 * Модель взаємодії — static: жодного слайдера, автопрокрутки чи паралаксу
 * (hero референсу виміряно як фіксований блок). Контракт К3-Е6д-9: дані
 * банера мають пріоритет — заголовок, підзаголовок і кнопки першого банера
 * з текстом показуються як є; без них (або без банерів) — тексти каталогу
 * теми. Вибір банера, фільтр кнопок і колір накладки — `pickHeroBanner` ядра.
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
  const hero = pickHeroBanner(banners);
  const picked = pickHeroImage(banners);
  const image = picked?.url ?? null;
  const buttons = hero?.buttons ?? [];
  // Вирівнювання лише з банером: у фолбеку блок лишається як був.
  const align = hero ? ALIGN[hero.textPosition] : null;
  const overlay = hero?.overlayColor ?? undefined;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 md:py-20">
      <div
        className={`grid items-center gap-10 ${image ? 'md:grid-cols-2' : ''}`}
      >
        <div className={align?.text}>
          <span
            className="inline-flex items-center rounded-full border border-border/80 bg-card/80 px-4 py-2 text-[13px] font-medium text-foreground"
            style={{ fontFamily: MONO_STACK }}
          >
            {tt('theme.hero.badge')}
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.025em] text-foreground md:text-5xl lg:text-[64px]">
            {hero?.title ? (
              hero.title
            ) : (
              <>
                {tt('theme.hero.titleLine1')}
                <br />
                {tt('theme.hero.titleLine2')}
              </>
            )}
          </h1>

          {(hero ? hero.subtitle : tt('theme.hero.subtitle')) && (
            <p className="mt-6 max-w-[448px] text-[17px] leading-[1.625] text-muted-foreground">
              {hero ? hero.subtitle : tt('theme.hero.subtitle')}
            </p>
          )}

          <div
            className={`mt-8 flex flex-col gap-3 sm:flex-row ${align?.row ?? ''}`}
          >
            {buttons.length > 0 ? (
              buttons.map((btn, i) => <BannerCta key={i} button={btn} />)
            ) : (
              <>
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
              </>
            )}
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
            <div className="flex aspect-square w-full max-w-[320px] items-center justify-center relative overflow-hidden rounded-full border border-border bg-card md:max-w-[440px]">
              <img
                src={image}
                alt={picked?.alt ?? ''}
                className="h-full w-full object-cover"
              />
              {overlay && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: overlay }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
