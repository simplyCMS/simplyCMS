import { resolveMediaUrl } from 'simplycms/domain/media';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { ImageIcon, Trash2 } from 'lucide-react';
import type { ProductListRow } from './useProductsList';

interface Props {
  readonly product: ProductListRow;
  readonly onOpen: (id: string) => void;
  readonly onDeleteRequest: (row: ProductListRow) => void;
}

/** Один рядок списку товарів: мініатюра, назва, розділ, бейдж активності. */
export default function ProductRow({
  product,
  onOpen,
  onDeleteRequest,
}: Props) {
  const t = useT();
  const thumb = resolveMediaUrl(product.images?.[0] ?? null);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onOpen(product.id)}
    >
      <TableCell>
        {thumb ? (
          <img
            src={thumb}
            alt={product.name}
            width={40}
            height={40}
            className="object-cover rounded"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
            <ImageIcon
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {product.sectionName ?? '—'}
      </TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            product.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {product.isActive
            ? t('common.activeM')
            : t('admin.sections.inactive')}
        </span>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('common.delete')}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRequest(product);
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
