// Типовий тест осі контенту: перевіряє `pnpm typecheck`, не vitest.
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import {
  checkedContentLocale,
  checkedTextLocale,
} from 'simplycms/domain/translations';

// @ts-expect-error сирий рядок не є мовою контенту
entityKey(ENTITY.products, 'uk');

// @ts-expect-error TextLocale збирається лише з ContentLocale
checkedTextLocale('uk', 'uk');

entityKey(ENTITY.products, checkedContentLocale('uk'));
