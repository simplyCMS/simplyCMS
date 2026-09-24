import { toast } from 'sonner';
import type { Translator } from 'simplycms/i18n';
import { adminErrorKey } from './admin-error';

/**
 * Тост помилки миттєвої транзакції колекції (рев'ю C6, item 2) — патерн
 * `ProductsTable.handleDelete`, винесений у спільний хелпер для контролів
 * над ЖИВИМ рядком (`SimpleProductPanel`, `ModificationStatusControl`):
 * `products.update`/`mods.update` без `.catch` на `tx.isPersisted.promise`
 * давали тихий rollback колекції (бібліотека відкочує сама) і unhandled
 * rejection у консолі — відхилена мутація нікому не звітувала.
 */
export function reportTxError(t: Translator, e: unknown): void {
  const key = adminErrorKey(e);
  toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
}
