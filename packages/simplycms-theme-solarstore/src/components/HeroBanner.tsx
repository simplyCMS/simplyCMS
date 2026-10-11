import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { Banner } from 'simplycms/contracts/objects';
import { isBannerButton, isSafeCssValue } from 'simplycms/domain';
import { Button } from 'simplycms/ui/button';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { SolarstoreThemeKey } from '../messages';

const ALIGN = {
  left: { text: 'text-left', row: 'justify-start' },
  center: { text: 'text-center', row: 'justify-center' },
  right: { text: 'text-right', row: 'justify-end' },
} as const;

/**
 * Hero SolarStore — статичний банер із колишньої `pages/HomePage.tsx`.
 *
 * Контракт К3-Е6д-9: дані банера мають пріоритет — заголовок, підзаголовок і
 * кнопки першого банера з текстом показуються як є; без них (або без банерів)
 * лишається фіксований маркетинговий блок з каталогу теми. Слайдера немає.
 * Фільтр кнопок і кольору накладки — функції ядра, не власна логіка теми.
 *
 * 🔴 Заголовок розбитий на 3 ключі (`titlePrefix`/`titleHighlight`/
 * `titleSuffix`): виділений `<span>` сидить усередині речення, і єдиний
 * ключ на весь рядок не дав би підсвітити саме середнє слово незалежно від
 * порядку слів у перекладі.
 */
export function HeroBanner({ banners = [] }: { banners?: Banner[] }) {
  const tt = useThemeT<SolarstoreThemeKey>();
  const data = banners.find(
    (item) => item.title || item.buttons.some(isBannerButton),
  );
  const buttons = data?.buttons.filter(isBannerButton) ?? [];
  const align = ALIGN[data?.text_position ?? 'center'];
  const overlay = isSafeCssValue(data?.overlay_color)
    ? data.overlay_color
    : undefined;

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div
        className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5"
        style={overlay ? { background: overlay } : undefined}
      />
      <div className="container mx-auto px-4 relative">
        <div className={`mx-auto max-w-3xl ${align.text}`}>
          <h1 className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl">
            {data?.title ? (
              data.title
            ) : (
              <>
                {tt('theme.hero.titlePrefix')}{' '}
                <span className="text-[hsl(var(--primary))]">
                  {tt('theme.hero.titleHighlight')}
                </span>{' '}
                {tt('theme.hero.titleSuffix')}
              </>
            )}
          </h1>
          {(data ? data.subtitle : tt('theme.hero.subtitle')) && (
            <p className="mt-6 text-lg text-[hsl(var(--muted-foreground))] md:text-xl">
              {data ? data.subtitle : tt('theme.hero.subtitle')}
            </p>
          )}
          <div className={`mt-10 flex flex-wrap gap-4 ${align.row}`}>
            {buttons.length > 0 ? (
              buttons.map((btn, i) => (
                <Button
                  key={i}
                  size="lg"
                  variant={btn.variant === 'outline' ? 'outline' : 'default'}
                  className={
                    btn.variant === 'outline'
                      ? 'h-12 px-8'
                      : 'bg-[hsl(var(--primary))] text-white border-0 h-12 px-8 hover:bg-[hsl(var(--primary))]/90'
                  }
                  asChild
                >
                  {btn.url.startsWith('/') && btn.target !== '_blank' ? (
                    <Link to={btn.url}>{btn.text}</Link>
                  ) : (
                    <a
                      href={btn.url}
                      {...(btn.target === '_blank'
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {btn.text}
                    </a>
                  )}
                </Button>
              ))
            ) : (
              <>
                <Button
                  size="lg"
                  className="bg-[hsl(var(--primary))] text-white border-0 h-12 px-8 hover:bg-[hsl(var(--primary))]/90"
                  asChild
                >
                  <Link to="/catalog">
                    {tt('theme.hero.ctaCatalog')}
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8">
                  {tt('theme.hero.ctaConsultation')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
