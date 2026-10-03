import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from 'simplycms/ui/button';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

interface HeaderProps {
  /** Куди веде кнопка «назад» (вже `adminPath(...)`). */
  readonly backTo: string;
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  /** Права частина шапки — зазвичай кнопка видалення. */
  readonly action?: ReactNode;
}

/** Шапка картки довідника: «назад», заголовок, підзаголовок, дія. */
export function CardPageHeader({
  backTo,
  title,
  subtitle,
  action,
}: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

interface SubmitProps {
  readonly pending: boolean;
  readonly children: ReactNode;
  /** Показувати іконку збереження, коли запит не в дорозі. */
  readonly idleIcon?: boolean;
}

/** Кнопка submit картки: спінер, поки збереження в дорозі. */
export function SubmitButton({
  pending,
  children,
  idleIcon = true,
}: SubmitProps) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        idleIcon && <Save className="mr-2 h-4 w-4" />
      )}
      {children}
    </Button>
  );
}
