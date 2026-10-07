import { useNavigate } from '@tanstack/react-router';
import { parseCategoryRuleConditions } from 'simplycms/domain/user-categories';
import { useT } from 'simplycms/i18n';
import type { CategoryRule } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { fieldMeta, operatorLabel } from './rule-field-catalog';

interface Props {
  readonly rule: CategoryRule;
  readonly fromName: string | null;
  readonly toName: string | null;
  readonly onToggle: (isActive: boolean) => void;
  readonly onPriority: (delta: 1 | -1) => void;
}

/** Умови правила бейджами; невалідні (вписані в обхід Zod) показуються як «—». */
function ConditionBadges({ rule }: { readonly rule: CategoryRule }) {
  const t = useT();
  const parsed = parseCategoryRuleConditions(rule.conditions);
  if (!parsed) return <span className="text-muted-foreground">—</span>;
  const join = t(
    parsed.type === 'all' ? 'admin.users.rules.and' : 'admin.users.rules.or',
  );
  return parsed.rules.map((r, i) => {
    const meta = fieldMeta(r.field);
    const op = operatorLabel(r.operator, !!meta?.numeric);
    return (
      <span key={i} className="inline-flex items-center gap-1">
        {i > 0 && <span className="mx-1 text-muted-foreground">{join}</span>}
        <Badge variant="outline" className="font-normal">
          {meta ? t(meta.label) : r.field} {'key' in op ? t(op.key) : op.text}{' '}
          {r.value}
        </Badge>
      </span>
    );
  });
}

/** Рядок списку правил: пріоритет зі стрілками, перехід, умови, активність. */
export function CategoryRuleRow({
  rule,
  fromName,
  toName,
  onToggle,
  onPriority,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() =>
        navigate({ to: adminPath(`user-categories/rules/${rule.id}`) })
      }
    >
      <TableCell onClick={stop}>
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm">{rule.priority}</span>
          <div className="flex flex-col">
            {([1, -1] as const).map((delta) => (
              <Button
                key={delta}
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                aria-label={`${t('common.priority')} ${delta > 0 ? '+1' : '−1'}`}
                onClick={() => onPriority(delta)}
              >
                {delta > 0 ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            ))}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{rule.name}</div>
        {rule.description && (
          <p className="text-sm text-muted-foreground">{rule.description}</p>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {fromName ?? t('admin.users.rules.any')}
          </Badge>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <Badge>{toName}</Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <ConditionBadges rule={rule} />
        </div>
      </TableCell>
      <TableCell className="text-center" onClick={stop}>
        <Switch
          checked={rule.isActive}
          aria-label={t('common.activeN')}
          onCheckedChange={onToggle}
        />
      </TableCell>
    </TableRow>
  );
}
