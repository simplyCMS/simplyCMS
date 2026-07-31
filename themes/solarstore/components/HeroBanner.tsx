import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Button } from "@simplycms/ui/button";

/**
 * Hero SolarStore — статичний банер із колишньої `pages/HomePage.tsx`.
 *
 * Ядро передає сюди `banners` з БД, але ця тема свідомо їх не використовує:
 * її hero — фіксований маркетинговий блок, а не слайдер. Пропси тому не
 * оголошуємо (компонент без пропсів сумісний із `ComponentType<{banners}>`).
 */
export function HeroBanner() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/10 to-[hsl(var(--primary))]/5" />
      <div className="container mx-auto px-4 relative">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-[hsl(var(--foreground))] sm:text-5xl md:text-6xl">
            Енергетична{" "}
            <span className="text-[hsl(var(--primary))]">незалежність</span> для
            вашого дому
          </h1>
          <p className="mt-6 text-lg text-[hsl(var(--muted-foreground))] md:text-xl">
            Професійні рішення з альтернативної енергетики: акумулятори,
            інвертори, сонячні панелі та послуги монтажу під ключ
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              className="bg-[hsl(var(--primary))] text-white border-0 h-12 px-8 hover:bg-[hsl(var(--primary))]/90"
              asChild
            >
              <Link to="/catalog">
                Переглянути каталог
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8">
              Замовити консультацію
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
