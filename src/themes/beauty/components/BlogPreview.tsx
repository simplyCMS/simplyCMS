import { useThemeSettings } from "@/lib/themes";
import { Image } from "lucide-react";

const mockArticles = [
  {
    id: "1",
    title: "Як обрати ідеальний засіб для догляду",
    excerpt: "Поради від експертів щодо підбору косметики для вашого типу шкіри.",
    date: "15 лютого 2026",
  },
  {
    id: "2",
    title: "Тренди краси 2026 року",
    excerpt: "Огляд найактуальніших тенденцій у світі б'юті-індустрії.",
    date: "10 лютого 2026",
  },
  {
    id: "3",
    title: "Догляд за шкірою взимку",
    excerpt: "Правила зволоження та захисту шкіри в холодну пору року.",
    date: "5 лютого 2026",
  },
];

export function BlogPreview() {
  const show = useThemeSettings<boolean>("showBlogPreview");

  if (!show) return null;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-serif font-bold text-foreground text-center mb-8 uppercase tracking-wider">
          Останні статті
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockArticles.map((article) => (
            <div key={article.id} className="group cursor-pointer">
              <div className="aspect-video rounded-md bg-muted mb-3 overflow-hidden flex items-center justify-center">
                <Image className="h-10 w-10 text-muted-foreground/30" />
              </div>
              <p className="text-xs text-muted-foreground mb-1">{article.date}</p>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                {article.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {article.excerpt}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
