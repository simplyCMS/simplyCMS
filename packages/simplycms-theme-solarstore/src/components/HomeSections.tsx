import { Button } from 'simplycms/ui/button';
import { Card } from 'simplycms/ui/card';
import { useThemeT } from 'simplycms/themes/useThemeT';
import type { SolarstoreThemeKey } from '../messages';

/** Переваги компанії — число лишається літералом, підпис іде ключем теми */
const advantages = [
  { value: '5+', labelKey: 'theme.home.advantage1' },
  { value: '1000+', labelKey: 'theme.home.advantage2' },
  { value: '24/7', labelKey: 'theme.home.advantage3' },
  { value: '3', labelKey: 'theme.home.advantage4' },
] as const satisfies ReadonlyArray<{
  value: string;
  labelKey: SolarstoreThemeKey;
}>;

/**
 * Унікальні секції головної SolarStore — переваги і CTA-блок.
 *
 * Перенесені з колишньої `pages/HomePage.tsx` без змін розмітки. Секції, які
 * дублювали канонічний body ядра (товарні добірки й каруселі за кореневими
 * секціями), сюди НЕ переносяться — їх рендерить ядро ПЕРЕД цим слотом.
 */
export function HomeSections() {
  const tt = useThemeT<SolarstoreThemeKey>();

  return (
    <>
      {/* Переваги */}
      <section className="py-16 md:py-24 bg-[hsl(var(--muted))]/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[hsl(var(--foreground))]">
              {tt('theme.home.advantagesHeading')}
            </h2>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {advantages.map((item) => (
              <div key={item.labelKey} className="text-center">
                <div className="text-4xl font-bold text-[hsl(var(--primary))]">
                  {item.value}
                </div>
                <div className="mt-2 text-[hsl(var(--muted-foreground))]">
                  {tt(item.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <Card className="overflow-hidden">
            <div className="relative p-8 md:p-12 bg-[hsl(var(--primary))]">
              <div className="relative z-10 max-w-2xl">
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  {tt('theme.home.ctaHeading')}
                </h2>
                <p className="mt-4 text-white/90">{tt('theme.home.ctaText')}</p>
                <Button size="lg" variant="secondary" className="mt-6">
                  {tt('theme.home.ctaButton')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </>
  );
}
