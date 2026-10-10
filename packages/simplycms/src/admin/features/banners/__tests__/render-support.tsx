import { fireEvent, screen } from '@testing-library/react';
import type { Banner, Section } from 'simplycms/schema/types';

export {
  stubDom,
  wrapper,
} from '../../shipping/methods/__tests__/render-support';
export { stateConflict } from '../../shipping/zones/__tests__/render-support';

const base: Banner = {
  id: '',
  title: '',
  subtitle: null,
  imageUrl: 'banner/b1/main.jpg',
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  placement: 'home',
  sectionId: null,
  buttons: [],
  dateFrom: null,
  dateTo: null,
  scheduleDays: null,
  scheduleTimeFrom: null,
  scheduleTimeTo: null,
  slideDuration: 5000,
  animationType: 'slide',
  animationDuration: 500,
  overlayColor: 'rgba(0,0,0,0.4)',
  textPosition: 'left',
  desktopImageUrl: null,
  mobileImageUrl: null,
};

export const SECTION_ID = 'c0000000-0000-4000-8000-000000000001';

export const SECTIONS: Section[] = [
  {
    id: SECTION_ID,
    slug: 'laptops',
    name: 'Ноутбуки',
    description: null,
    imageUrl: null,
    parentId: null,
    sortOrder: 0,
    isActive: true,
    metaTitle: null,
    metaDescription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/** Звичайний банер із розкладом (дата початку) і банер розділу. */
export const BANNERS: Banner[] = [
  {
    ...base,
    id: 'd0000000-0000-4000-8000-000000000001',
    title: 'Літній розпродаж',
    dateFrom: new Date(2026, 9, 1, 8, 0),
    scheduleTimeFrom: '09:00:00',
  },
  {
    ...base,
    id: 'd0000000-0000-4000-8000-000000000002',
    title: 'Банер ноутбуків',
    placement: 'section',
    sectionId: SECTION_ID,
    sortOrder: 1,
    imageUrl: 'banner/b2/main.jpg',
  },
];

/** Те, що кидає сервер (`ValidationError`); адаптер serverFn тут не потрібен. */
export const serverValidationError = (
  issues: Array<{ path: string[]; code: string }>,
) =>
  Object.assign(new Error('validation'), { name: 'ValidationError', issues });
export type Call = {
  data: Array<{ id: string; patch: Record<string, unknown> }>;
};

/** Radix Select у jsdom: відкрити тригер за підписом і клікнути опцію. */
export const pick = async (label: string, option: string) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
};
