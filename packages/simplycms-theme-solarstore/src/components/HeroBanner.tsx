import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Button } from 'simplycms/ui/button';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { SolarstoreThemeKey } from '../messages';

/**
 * Hero SolarStore — статичний банер із колишньої `pages/HomePage.tsx`.
 *
 * Ядро передає сюди `banners` з БД, але ця тема свідомо їх не використовує:
 * її hero — фіксований маркетинговий блок, а не слайдер. Пропси тому не
 * оголошуємо (компонент без пропсів сумісний із `ComponentType<{banners}>`).
 *
 * 🔴 Заголовок розбитий на 3 ключі (`titlePrefix`/`titleHighlight`/
 * `titleSuffix`): виділений `<span>` сидить усередині речення, і єдиний
 * ключ на весь рядок не дав би підсвітити саме середнє слово незалежно від
 * порядку слів у перекладі.
 */
export function HeroBanner() {
  const tt = useThemeT<SolarstoreThemeKey>();

  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
      <div className="container mx-auto px-4 relative">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl">
            {tt('theme.hero.titlePrefix')}{' '}
            <span className="text-[hsl(var(--primary))]">
              {tt('theme.hero.titleHighlight')}
            </span>{' '}
            {tt('theme.hero.titleSuffix')}
          </h1>
          <p className="mt-6 text-lg text-[hsl(var(--muted-foreground))] md:text-xl">
            {tt('theme.hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
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
          </div>
        </div>
      </div>
    </section>
  );
}
