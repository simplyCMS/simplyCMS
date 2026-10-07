import { useLiveQuery } from '@tanstack/react-db';
import { sectionsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import type { FormTarget } from './discount-form-schema';

/** Ціль-розділ: вибір із довідника розділів (eager, обмежений розмір). */
export function SectionTargetSelect({
  onAdd,
}: {
  readonly onAdd: (target: FormTarget) => void;
}) {
  const t = useT();
  const sectionsCol = useCollection(sectionsCollection);
  const { data: sections } = useLiveQuery({
    query: (q) => q.from({ s: sectionsCol }).orderBy(({ s }) => s.name, 'asc'),
  });
  return (
    <Select
      value=""
      onValueChange={(id) =>
        id !== '' && onAdd({ targetType: 'section', targetId: id })
      }
    >
      <SelectTrigger className="w-56">
        <SelectValue placeholder={t('admin.discounts.addSection')} />
      </SelectTrigger>
      <SelectContent>
        {sections.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
