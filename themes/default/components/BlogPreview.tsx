import { useThemeSettings } from '@simplycms/core/hooks/useThemeSettings';
import { useThemeT } from '@simplycms/themes/useThemeT';
import { ImageIcon } from 'lucide-react';
import type { DefaultThemeKey } from '../messages';

/**
 * Ключі мокових статей — самого тексту тут немає, він живе в `../messages.ts`
 * (`theme.blog.*`): фікстурний контент теми так само каталог, як і решта.
 */
const mockArticleKeys = [
  {
    id: '1',
    titleKey: 'theme.blog.article1Title',
    excerptKey: 'theme.blog.article1Excerpt',
    dateKey: 'theme.blog.article1Date',
  },
  {
    id: '2',
    titleKey: 'theme.blog.article2Title',
    excerptKey: 'theme.blog.article2Excerpt',
    dateKey: 'theme.blog.article2Date',
  },
  {
    id: '3',
    titleKey: 'theme.blog.article3Title',
    excerptKey: 'theme.blog.article3Excerpt',
    dateKey: 'theme.blog.article3Date',
  },
] as const satisfies ReadonlyArray<{
  id: string;
  titleKey: DefaultThemeKey;
  excerptKey: DefaultThemeKey;
  dateKey: DefaultThemeKey;
}>;

export function BlogPreview() {
  const tt = useThemeT<DefaultThemeKey>();
  const show = useThemeSettings<boolean>('showBlogPreview');

  if (!show) return null;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-xl font-serif font-bold text-foreground text-center mb-8 uppercase tracking-wider">
          {tt('theme.blog.heading')}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {mockArticleKeys.map((article) => (
            <div key={article.id} className="group cursor-pointer">
              <div className="aspect-video rounded-md bg-muted mb-3 overflow-hidden flex items-center justify-center">
                <ImageIcon
                  className="h-10 w-10 text-muted-foreground/30"
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs text-muted-foreground mb-1">
                {tt(article.dateKey)}
              </p>
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                {tt(article.titleKey)}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {tt(article.excerptKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
