import { useT } from 'simplycms/i18n';
import type { AdminCategoryHistoryEntry } from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';
import { useFormatDate } from './useFormatDate';

/** Історія категорій: переведення правилом або email адміна, причина, дата. */
export default function CustomerHistoryList({
  history,
}: {
  readonly history: readonly AdminCategoryHistoryEntry[];
}) {
  const t = useT();
  const formatDate = useFormatDate();
  if (history.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {t('admin.users.historyEmpty')}
      </p>
    );
  return (
    <ul className="space-y-2 text-sm">
      {history.map((h) => (
        <li key={h.id} className="rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {h.fromName ?? '—'} → <strong>{h.toName}</strong>
            </span>
            {h.byRule ? (
              <Badge variant="secondary">
                {t('admin.users.card.historyRule')}
              </Badge>
            ) : (
              h.changedByEmail && (
                <span className="text-muted-foreground">
                  {h.changedByEmail}
                </span>
              )
            )}
          </div>
          <div className="text-muted-foreground">
            {formatDate(h.createdAt)}
            {h.reason && ` · ${h.reason}`}
          </div>
        </li>
      ))}
    </ul>
  );
}
