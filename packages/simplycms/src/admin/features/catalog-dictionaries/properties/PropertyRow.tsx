import type { SectionProperty } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { PROPERTY_TYPE_LABEL } from './property-form-schema';

interface Props {
  readonly property: SectionProperty;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}

/** Рядок списку властивостей: клік — картка, кошик — підтвердження. */
export function PropertyRow({ property, onOpen, onDelete }: Props) {
  const t = useT();
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <TableCell className="font-medium">
        {property.name}
        {property.isRequired && (
          <span className="text-destructive ml-1">*</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {property.slug}
      </TableCell>
      <TableCell>{t(PROPERTY_TYPE_LABEL[property.propertyType])}</TableCell>
      <TableCell>
        {property.isFilterable ? (
          <span className="text-green-600">{t('common.yes')}</span>
        ) : (
          <span className="text-muted-foreground">{t('common.no')}</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('admin.properties.delete')}
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
