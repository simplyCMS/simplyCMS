import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import { adminPath } from '../../../lib/adminLinks';
import { adminErrorKey } from '../../../lib/admin-error';
import {
  applyServerValidation,
  type FormErrorBinding,
} from '../../../lib/apply-server-validation';
import {
  toProductDraft,
  toProductPatch,
  type ProductFormValues,
} from './product-form-schema';

/**
 * Створення й збереження товару через колекцію (оптимізм + write-back
 * хендлерів Task 5). `isPersisted` чекається ДО навігації/тосту успіху —
 * успіх показується лише після підтвердження сервера. Review Focus 1:
 * конфлікт slug — тост з i18n-ключем, форма НЕ скидається (введене
 * лишається, бо помилковий шлях не викликає `form.reset`).
 */
export function useProductSave() {
  const products = useCollection(productsCollection);
  const navigate = useNavigate();
  const t = useT();

  const fail = (e: unknown, binding?: FormErrorBinding) => {
    // Тема 12: помилка валідації сервера → помилка ПОЛЯ форми; тост — лише
    // для того, що до поля не привʼязалось (або якщо форми нема).
    const rest = binding
      ? applyServerValidation(e, binding.setError, {
          t,
          fieldFor: binding.fieldFor,
        })
      : null;
    if (rest !== null) {
      if (rest.length > 0) toast.error(t('admin.validation.failed'));
      return;
    }
    const key = adminErrorKey(e);
    toast.error(key ? t(key) : `${t('common.error')} ${(e as Error).message}`);
  };

  const create = async (
    values: ProductFormValues,
    binding?: FormErrorBinding,
  ) => {
    try {
      const id = crypto.randomUUID(); // контракт id: ключ генерує клієнт (К3-6)
      const tx = products.insert(toProductDraft(values, id, new Date()));
      await tx.isPersisted.promise;
      toast.success(t('admin.products.created'));
      await navigate({
        to: adminPath('products/$productId'),
        params: { productId: id },
      });
    } catch (e) {
      fail(e, binding);
    }
  };

  const update = async (
    id: string,
    values: ProductFormValues,
    binding?: FormErrorBinding,
  ) => {
    const patch = toProductPatch(values);
    // 🔴 Updater мусить лишити слід у draft (А-4: порожній draft — тихий
    // no-op без запиту). Object.assign пише всі поля patch завжди.
    const tx = products.update(id, (draft) => {
      Object.assign(draft, patch);
    });
    try {
      await tx.isPersisted.promise;
      toast.success(t('admin.products.updated'));
    } catch (e) {
      fail(e, binding);
    }
  };

  return { create, update };
}
