import { useNavigate } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { PickupPoint } from 'simplycms/schema/types';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Switch } from 'simplycms/ui/switch';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';

interface Props {
  readonly point: PickupPoint;
  readonly zoneName: string | undefined;
  readonly onToggle: (isActive: boolean) => void;
  readonly onDelete: () => void;
}

/** Рядок списку точок. Системна точка (склад) — бейдж і без кнопки видалення. */
export function PickupPointRow({ point, zoneName, onToggle, onDelete }: Props) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() =>
        navigate({ to: adminPath(`shipping/pickup-points/${point.id}`) })
      }
    >
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{point.name}</span>
          {point.isSystem && (
            <Badge variant="secondary">
              {t('admin.shipping.points.system')}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>{point.city}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {point.address}
      </TableCell>
      <TableCell>
        {zoneName ? <Badge variant="outline">{zoneName}</Badge> : '—'}
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={point.isActive}
          aria-label={t('common.activeF')}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
        />
      </TableCell>
      <TableCell className="text-right">
        {!point.isSystem && (
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
        )}
      </TableCell>
    </TableRow>
  );
}
