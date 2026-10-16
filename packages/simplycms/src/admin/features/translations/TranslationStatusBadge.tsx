import { useT } from 'simplycms/i18n';
import { Badge } from 'simplycms/ui/badge';
import type { TranslationStatus } from './translation-context';

interface Props {
  readonly status: TranslationStatus;
  /** Актуальний переклад за замовчуванням нічого не показує: шум лише заважає. */
  readonly showCurrent?: boolean;
}

/** Бейдж статусу поля чи рядка перекладу: «Застарілий» / «Немає перекладу». */
export function TranslationStatusBadge({ status, showCurrent = false }: Props) {
  const t = useT();
  if (status === 'current' && !showCurrent) return null;
  return (
    <Badge
      variant={
        status === 'outdated'
          ? 'destructive'
          : status === 'missing'
            ? 'outline'
            : 'secondary'
      }
      title={
        status === 'outdated'
          ? t('admin.translations.status.outdatedHint')
          : undefined
      }
      data-status={status}
    >
      {t(`admin.translations.status.${status}`)}
    </Badge>
  );
}
