import { useNavigate } from '@tanstack/react-router';
import { isShippingProviderId } from 'simplycms/contracts/shipping-providers';
import { useT } from 'simplycms/i18n';
import type { ShippingMethod } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { PRICING_LABEL, PROVIDER_LABEL } from './shipping-labels';

interface Props {
  readonly method: ShippingMethod;
  readonly onToggle: (isActive: boolean) => void;
  readonly onDelete: () => void;
}

/** Рядок списку способів: клік відкриває картку, перемикач і кошик — ні. */
export function ShippingMethodRow({ method: m, onToggle, onDelete }: Props) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => navigate({ to: adminPath(`shipping/methods/${m.id}`) })}
    >
      <TableCell className="font-medium">{m.name}</TableCell>
      <TableCell>
        {isShippingProviderId(m.provider)
          ? t(PROVIDER_LABEL[m.provider])
          : m.provider}
      </TableCell>
      <TableCell>{t(PRICING_LABEL[m.pricing])}</TableCell>
      <TableCell className="text-center">
        <Switch
          checked={m.isActive}
          aria-label={t('common.activeF')}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell>{m.sortOrder}</TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
