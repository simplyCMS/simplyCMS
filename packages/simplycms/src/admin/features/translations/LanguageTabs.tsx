import { useT } from 'simplycms/i18n';
import { Tabs, TabsList, TabsTrigger } from 'simplycms/ui/tabs';
import { TranslationStatusBadge } from './TranslationStatusBadge';
import type { LanguageInfo, TranslationStatus } from './translation-context';

interface Props {
  readonly languages: readonly LanguageInfo[];
  readonly active: string;
  readonly onChange: (code: string) => void;
  /** Статус рядка мови; для основної мови не викликається. */
  readonly statusOf: (code: string) => TranslationStatus;
}

/**
 * Вкладки мов картки. Основна мова позначена «джерело», решта несуть бейдж
 * статусу рядка: застарілий чи відсутній переклад видно ще до відкриття вкладки.
 * Самі поля вкладки рендерить картка, тож це лише перемикач.
 */
export function LanguageTabs({ languages, active, onChange, statusOf }: Props) {
  const t = useT();
  return (
    <Tabs value={active} onValueChange={onChange}>
      <TabsList
        className="h-auto flex-wrap justify-start"
        aria-label={t('admin.translations.languages')}
      >
        {languages.map((l) => (
          <TabsTrigger key={l.code} value={l.code} className="gap-2">
            <span>{l.name}</span>
            <span className="text-xs text-muted-foreground">{l.code}</span>
            {l.isDefault ? (
              <span className="text-xs rounded bg-primary/10 px-1.5 text-primary">
                {t('admin.translations.source')}
              </span>
            ) : (
              <TranslationStatusBadge status={statusOf(l.code)} />
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
