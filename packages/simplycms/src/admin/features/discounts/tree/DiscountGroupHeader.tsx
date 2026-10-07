import { Link } from '@tanstack/react-router';
import { useLocale, useT } from 'simplycms/i18n';
import type { DiscountGroup } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { cn } from 'simplycms/ui/utils';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { OPERATOR_SHORT } from '../discount-labels';

interface Props {
  readonly group: DiscountGroup;
  readonly expanded: boolean;
  readonly onToggleExpanded: () => void;
  readonly onToggleActive: (isActive: boolean) => void;
  readonly onDelete: () => void;
}

/** Рядок групи в дереві: оператор, назва, період дії, активність, дії. */
export function DiscountGroupHeader({
  group,
  expanded,
  onToggleExpanded,
  onToggleActive,
  onDelete,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const day = (d: Date | null) => (d ? d.toLocaleDateString(locale) : '∞');
  const label = { name: group.name };
  return (
    <div className="flex items-center gap-2 py-2">
      <button
        type="button"
        className="p-0.5"
        aria-expanded={expanded}
        aria-label={t('admin.discounts.expandLabel', label)}
        onClick={onToggleExpanded}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      <Badge variant="outline">{t(OPERATOR_SHORT[group.operator])}</Badge>
      <span
        className={cn(
          'font-medium',
          !group.isActive && 'text-muted-foreground line-through',
        )}
      >
        {group.name}
      </span>
      {(group.startsAt || group.endsAt) && (
        <Badge variant="outline" className="text-xs">
          {day(group.startsAt)} — {day(group.endsAt)}
        </Badge>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Switch
          checked={group.isActive}
          aria-label={t('admin.discounts.toggleGroupLabel', label)}
          onCheckedChange={onToggleActive}
        />
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label={t('admin.discounts.editGroupLabel', label)}
        >
          <Link
            to={adminPath('discounts/groups/$groupId')}
            params={{ groupId: group.id }}
          >
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('admin.discounts.deleteGroupLabel', label)}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
