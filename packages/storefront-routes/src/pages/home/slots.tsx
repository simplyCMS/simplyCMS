// Слот секційної каруселі, прибінджений до контейнера (контракт тем v3,
// Фаза 5).

import type { HomeSectionSlotProps, HomeSlots } from '@simplycms/objects/views';
import { HomeSectionCarousel } from '../../views/slots/HomeSectionCarousel';
import { useHomeBindings } from './slot-context';

function SectionCarousel({ sectionId, className }: HomeSectionSlotProps) {
  const { sections } = useHomeBindings();
  const binding = sections[sectionId];
  // Секція без прив'язки — контейнер не викликав би слот з таким id узагалі;
  // гард лишається на випадок розсинхрону теми з даними.
  if (!binding) return null;

  return (
    <HomeSectionCarousel
      className={className}
      section={binding.section}
      initialData={binding.initialData}
    />
  );
}

/** Сталий набір реквізитів головної — саме він їде у view-model. */
export const homeSlots: HomeSlots = {
  SectionCarousel,
};
