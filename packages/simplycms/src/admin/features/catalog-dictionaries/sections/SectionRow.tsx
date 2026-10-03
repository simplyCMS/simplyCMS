import type { Section } from 'simplycms/schema/types';
import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import { TableCell, TableRow } from 'simplycms/ui/table';
import { Trash2 } from 'lucide-react';
import { MediaThumb } from '../MediaThumb';

interface Props {
  readonly section: Section;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}

/** Рядок списку розділів: клік — картка, кошик — підтвердження видалення. */
export function SectionRow({ section, onOpen, onDelete }: Props) {
  const t = useT();
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onOpen}>
      <TableCell>
        <MediaThumb reference={section.imageUrl} alt={section.name} size={40} />
      </TableCell>
      <TableCell className="font-medium">{section.name}</TableCell>
      <TableCell className="text-muted-foreground">{section.slug}</TableCell>
      <TableCell>{section.sortOrder}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            section.isActive
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          {section.isActive
            ? t('common.activeM')
            : t('admin.sections.inactive')}
        </span>
      </TableCell>
      <TableCell className="text-right">
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
