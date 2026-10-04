import { Pencil, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { OrderStatus } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { SYSTEM_ORDER_STATUS_CODES } from 'simplycms/contracts/order-status-codes';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';

interface Props {
  statuses: OrderStatus[];
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onEdit: (status: OrderStatus) => void;
  onDelete: (status: OrderStatus) => void;
}

/** Таблиця статусів: порядок, код, колір, дефолт, дії. */
export function StatusesTable({
  statuses,
  onReorder,
  onEdit,
  onDelete,
}: Props) {
  const t = useT();
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('common.code')}</TableHead>
            <TableHead>{t('common.color')}</TableHead>
            <TableHead>{t('common.byDefault')}</TableHead>
            <TableHead className="w-32">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statuses.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center py-8 text-muted-foreground"
              >
                {t('admin.orders.statuses.empty')}
              </TableCell>
            </TableRow>
          ) : (
            statuses.map((status, index) => {
              // Системні статуси тримають скасування замовлення (Е5-6).
              const locked = SYSTEM_ORDER_STATUS_CODES.includes(status.code);
              return (
                <TableRow key={status.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => onReorder(status.id, 'up')}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === statuses.length - 1}
                        onClick={() => onReorder(status.id, 'down')}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{status.name}</TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-muted rounded text-sm">
                      {status.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: status.color || '#6B7280' }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {status.color || '#6B7280'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {status.isDefault && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                        {t('common.byDefault')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(status)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(status)}
                        disabled={status.isDefault || locked}
                        title={
                          locked
                            ? t('admin.orders.statuses.systemLocked')
                            : undefined
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
