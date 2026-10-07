import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { Discount, DiscountGroup } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Plus } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { DiscountGroupHeader } from './DiscountGroupHeader';
import { DiscountRow } from './DiscountRow';
import type { DiscountTreeModel } from './useDiscountTree';

/** Дії дерева, спільні для всіх вузлів. */
export interface DiscountTreeActions {
  readonly isCollapsed: (groupId: string) => boolean;
  readonly toggleCollapsed: (groupId: string) => void;
  readonly toggleActive: (groupId: string, isActive: boolean) => void;
  readonly askDeleteGroup: (group: DiscountGroup) => void;
  readonly askDeleteDiscount: (discount: Discount) => void;
}

interface Props {
  readonly group: DiscountGroup;
  readonly model: DiscountTreeModel;
  readonly actions: DiscountTreeActions;
}

/** Вузол дерева: група, її знижки, вкладені групи й кнопки додавання. */
export function DiscountGroupNode({ group, model, actions }: Props) {
  const t = useT();
  const expanded = !actions.isCollapsed(group.id);
  return (
    <div className="mb-2 border-l-2 border-muted pl-4">
      <DiscountGroupHeader
        group={group}
        expanded={expanded}
        onToggleExpanded={() => actions.toggleCollapsed(group.id)}
        onToggleActive={(v) => actions.toggleActive(group.id, v)}
        onDelete={() => actions.askDeleteGroup(group)}
      />
      {expanded && (
        <div className="ml-2">
          {model.discountsOf(group.id).map((d) => (
            <DiscountRow
              key={d.id}
              discount={d}
              priceTypeName={model.priceTypeName(d.priceTypeId)}
              onDelete={() => actions.askDeleteDiscount(d)}
            />
          ))}
          {model.childrenOf(group.id).map((child) => (
            <div key={child.id} className="ml-6">
              <DiscountGroupNode
                group={child}
                model={model}
                actions={actions}
              />
            </div>
          ))}
          <div className="flex gap-2 py-1 pl-6">
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link
                to={adminPath('discounts/$discountId')}
                params={{ discountId: 'new' }}
                search={{ groupId: group.id }}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('admin.discounts.discount')}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
              <Link
                to={adminPath('discounts/groups/$groupId')}
                params={{ groupId: 'new' }}
                search={{ parentId: group.id }}
              >
                <Plus className="mr-1 h-3 w-3" />
                {t('admin.discounts.subgroup')}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
