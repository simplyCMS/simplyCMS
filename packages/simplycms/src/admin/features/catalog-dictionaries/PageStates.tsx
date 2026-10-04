import { Link } from '@tanstack/react-router';
import { Button } from 'simplycms/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

/** Спінер сторінки довідника, поки колекція вантажиться. */
export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

/** Спінер вкладеного блоку (таблиці опцій, призначень). */
export function BlockSpinner() {
  return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}

interface NotFoundProps {
  /** Куди веде кнопка «назад» (вже `adminPath(...)`). */
  readonly backTo: string;
  /** Вже перекладений текст стану. */
  readonly message: string;
}

/**
 * Невідомий id картки: без форми й без insert (інакше submit створив би
 * новий рядок) — лише повернення до списку.
 */
export function NotFoundState({ backTo, message }: NotFoundProps) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="icon" asChild>
        <Link to={backTo}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
      </Button>
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
