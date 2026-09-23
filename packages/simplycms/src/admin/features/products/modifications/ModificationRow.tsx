import { resolveMediaUrl } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import type { ProductModification, ProductPrice } from 'simplycms/schema/types';
import { Button } from 'simplycms/ui/button';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { ArrowDown, ArrowUp, ImageIcon, Trash2 } from 'lucide-react';
import { ModificationStatusBadge } from './ModificationStatusBadge';

interface Props {
  readonly mod: ProductModification;
  readonly price: ProductPrice | undefined;
  readonly formatPrice: (
    value: number,
    opts?: { minimumFractionDigits?: number },
  ) => string;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onEdit: () => void;
  readonly onReorder: (direction: 'up' | 'down') => void;
  readonly onDeleteRequest: () => void;
}

/** Один рядок таблиці модифікацій — виніс із `ModificationsTable.tsx` (канон 150 рядків). */
export function ModificationRow({
  mod,
  price,
  formatPrice,
  canMoveUp,
  canMoveDown,
  onEdit,
  onReorder,
  onDeleteRequest,
}: Props) {
  const t = useT();
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onEdit}>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!canMoveUp}
            onClick={(e) => {
              e.stopPropagation();
              onReorder('up');
            }}
          >
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!canMoveDown}
            onClick={(e) => {
              e.stopPropagation();
              onReorder('down');
            }}
          >
            <ArrowDown className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
      <TableCell>
        {mod.images?.[0] ? (
          <img
            src={resolveMediaUrl(mod.images[0]) ?? undefined}
            alt=""
            width={32}
            height={32}
            className="object-cover rounded"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
            <ImageIcon
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium">
        {mod.name}
        {mod.isDefault && (
          <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {t('common.byDefaultShort')}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{mod.sku || '—'}</TableCell>
      <TableCell>
        {price ? (
          <div className="flex flex-col">
            <span className="font-medium">
              {formatPrice(Number(price.price), { minimumFractionDigits: 2 })}
            </span>
            {price.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(Number(price.oldPrice), {
                  minimumFractionDigits: 2,
                })}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <ModificationStatusBadge status={mod.stockStatus} />
      </TableCell>
      <TableCell>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRequest();
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
