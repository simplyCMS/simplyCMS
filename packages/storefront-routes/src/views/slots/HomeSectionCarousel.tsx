import { HOME_REQUISITES } from 'simplycms/contracts/views';
import { cn } from '@simplycms/ui/utils';
import {
  SectionProductCarousel,
  type SectionProductCarouselProps,
} from '../../pages/home/SectionProductCarousel';

export interface HomeSectionCarouselProps extends SectionProductCarouselProps {
  className?: string;
}

/**
 * Реквізит «карусель товарів кореневої категорії». Запит робить сама
 * карусель (SSR-дані приходять через `initialData`), порожню категорію вона
 * не рендерить — тому маркер тримає прозора (`display: contents`) обгортка.
 */
export function HomeSectionCarousel({
  className,
  ...rest
}: HomeSectionCarouselProps) {
  return (
    <div
      data-simplycms-requisite={HOME_REQUISITES.SectionCarousel}
      className={cn('contents', className)}
    >
      <SectionProductCarousel {...rest} />
    </div>
  );
}
