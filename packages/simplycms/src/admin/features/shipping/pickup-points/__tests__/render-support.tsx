export {
  METHODS,
  ZONES,
  stubDom,
  wrapper,
} from '../../methods/__tests__/render-support';
export { stateConflict } from '../../zones/__tests__/render-support';
import { METHODS, ZONES } from '../../methods/__tests__/render-support';

const base = {
  workingHours: {},
  coordinates: null,
  phone: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
};

/** Склад (системна) і звичайна точка; обидві — на способі самовивозу. */
export const POINTS = [
  {
    ...base,
    id: 'e0000000-0000-4000-8000-000000000001',
    methodId: METHODS[1]!.id,
    name: 'Склад',
    address: 'вул. Складська, 1',
    city: 'Київ',
    zoneId: ZONES[0]!.id,
    isSystem: true,
  },
  {
    ...base,
    id: 'e0000000-0000-4000-8000-000000000002',
    methodId: METHODS[1]!.id,
    name: 'Відділення 5',
    address: 'вул. Хрещатик, 5',
    city: 'Київ',
    zoneId: null,
    isSystem: false,
    sortOrder: 1,
  },
];
