import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { FolderOpen } from 'lucide-react';
import { CATALOG_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { Badge } from '@simplycms/ui/badge';
import { cn } from '@simplycms/ui/utils';

/** Розділ у стрічці чипсів: мінімум полів, потрібних для бейджа й лінка. */
export interface SectionChip {
  id: string;
  name: string;
  slug: string;
  image_url?: string | null;
}

const CHIP_CLASS = 'cursor-pointer px-3 py-1.5 text-sm';

/** Вміст бейджа: іконка розділу (або зображення) + назва. */
function ChipContent({ section }: { section: SectionChip }): ReactNode {
  return (
    <>
      {section.image_url ? (
        <img
          src={section.image_url}
          alt=""
          width={16}
          height={16}
          className="rounded object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <FolderOpen className="w-3 h-3" />
      )}
      {section.name}
    </>
  );
}

interface ChipsRowProps {
  className?: string;
  children: ReactNode;
}

/** Спільний корінь обох варіантів — саме він несе маркер реквізиту. */
function ChipsRow({ className, children }: ChipsRowProps) {
  return (
    <div
      data-simplycms-requisite={CATALOG_REQUISITES.SectionChips}
      className={cn('flex flex-wrap gap-2 mb-6', className)}
    >
      {children}
    </div>
  );
}

export interface CatalogFilterChipsProps {
  className?: string;
  sections: SectionChip[];
  /** Обраний розділ; `null` — «усі товари». */
  selectedId: string | null;
  onSelect: (sectionId: string | null) => void;
}

/** Реквізит «чипси розділів» у каталозі: перемикають вибірку на місці. */
export function CatalogFilterChips({
  className,
  sections,
  selectedId,
  onSelect,
}: CatalogFilterChipsProps) {
  const t = useT();

  return (
    <ChipsRow className={className}>
      <Badge
        variant={selectedId === null ? 'default' : 'outline'}
        className={CHIP_CLASS}
        onClick={() => onSelect(null)}
      >
        {t('catalog.allProducts')}
      </Badge>
      {sections.map((section) => (
        <Badge
          key={section.id}
          variant={selectedId === section.id ? 'default' : 'outline'}
          className={cn(CHIP_CLASS, 'gap-2')}
          onClick={() => onSelect(section.id)}
        >
          <ChipContent section={section} />
        </Badge>
      ))}
    </ChipsRow>
  );
}

export interface CatalogLinkChipsProps {
  className?: string;
  sections: SectionChip[];
  /** Розділ поточної сторінки. */
  activeId: string;
}

/** Той самий реквізит на сторінці розділу: чипси ведуть на інші розділи. */
export function CatalogLinkChips({
  className,
  sections,
  activeId,
}: CatalogLinkChipsProps) {
  const t = useT();

  return (
    <ChipsRow className={className}>
      <Link to="/catalog">
        <Badge variant="outline" className={CHIP_CLASS}>
          {t('catalog.allProducts')}
        </Badge>
      </Link>
      {sections.map((section) => (
        <Link
          key={section.id}
          to="/catalog/$sectionSlug"
          params={{ sectionSlug: section.slug }}
        >
          <Badge
            variant={section.id === activeId ? 'default' : 'outline'}
            className={cn(CHIP_CLASS, 'gap-2')}
          >
            <ChipContent section={section} />
          </Badge>
        </Link>
      ))}
    </ChipsRow>
  );
}
