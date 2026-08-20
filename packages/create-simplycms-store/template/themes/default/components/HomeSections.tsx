import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useToast } from '@simplycms/core/hooks/use-toast';
import { useThemeT } from 'simplycms/themes/useThemeT';
import { MONO_LABEL, MONO_STACK } from './mono';
import type { ThemeKey } from '../messages';

/**
 * HomeSections default-теми — спека: локальний артефакт
 * `docs/design-references/…/components/HomeSections.spec.md` (поза git).
 *
 * Контракт слота: рендериться ПІСЛЯ канонічних секцій ядра і НЕ отримує
 * пропсів — дані тягне сам. Тут даних із БД немає взагалі: увесь текст із
 * каталогу теми.
 *
 * 🔴 Модель взаємодії — click, і сабміт свідомо НЕ ходить на бекенд:
 * механізму розсилки в ядрі немає (перевірено — `newsletter` існує лише як
 * власна секція default-теми). Тому поведінка та сама, що в каноні репо:
 * тост-подяка й очистка поля. Спінер «завантаження» тут був би брехнею про
 * те, що щось відправляється, — його немає навмисно.
 */
export function HomeSections() {
  const tt = useThemeT<ThemeKey>();
  const { toast } = useToast();
  const [email, setEmail] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    toast({
      title: tt('theme.newsletter.thanksTitle'),
      description: tt('theme.newsletter.thanksDescription'),
    });
    setEmail('');
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <div className="rounded-[--radius] bg-card px-6 py-10 text-center md:px-10 md:py-12">
        <p
          className={`${MONO_LABEL} text-muted-foreground`}
          style={{ fontFamily: MONO_STACK }}
        >
          {tt('theme.newsletter.label')}
        </p>

        <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em] text-foreground md:text-3xl">
          {tt('theme.newsletter.heading')}
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-[15px] text-muted-foreground">
          {tt('theme.newsletter.subtitle')}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-8 flex w-full max-w-[420px] flex-col gap-2 sm:flex-row"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={tt('theme.newsletter.placeholder')}
            aria-label={tt('theme.newsletter.placeholder')}
            className="h-12 flex-1 rounded-full border border-border bg-background px-5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <button
            type="submit"
            disabled={!email.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:self-center"
          >
            {tt('theme.newsletter.submit')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
