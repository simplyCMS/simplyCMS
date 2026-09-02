import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import {
  deleteMyAddress,
  getMyAddresses,
  saveMyAddress,
  type AddressRow,
} from '../lib/user-addresses';

export type { AddressRow };

/** Поля форми адреси: без `id` — створення, з `id` — редагування. */
export interface AddressFormInput {
  id?: string | null;
  name: string;
  city: string;
  address: string;
  isDefault: boolean;
}

/**
 * Ключ книги адрес — ОДИН на застосунок.
 *
 * 🔴 Чекаут і кабінет тримали різні ключі (`checkout-saved-addresses` і
 * `user-addresses`) над тими самими рядками: адреса, збережена в чекауті,
 * лишала кабінет із застарілим списком. Спільний ключ прибирає розсинхрон
 * за побудовою — інвалідація одна на обидва екрани.
 */
export const ADDRESS_BOOK_KEY = entityKey(ENTITY.userAddresses).list();

/**
 * Книга адрес покупця: список + збереження + видалення.
 *
 * 🔴 Жодного `userId` у параметрах — ідентичність бере серверна сесія.
 * `enabled` каже лише «покупець залогінений», тобто чи є сенс питати; чиї
 * рядки віддавати, вирішує не він.
 */
export function useAddressBook(enabled: boolean) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ADDRESS_BOOK_KEY });

  const list = useQuery({
    queryKey: ADDRESS_BOOK_KEY,
    queryFn: (): Promise<AddressRow[]> => getMyAddresses(),
    enabled,
  });

  const save = useMutation({
    mutationFn: (input: AddressFormInput): Promise<string | null> =>
      saveMyAddress({ data: input }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string): Promise<boolean> =>
      deleteMyAddress({ data: { id } }),
    onSuccess: invalidate,
  });

  return { addresses: list.data, isLoading: list.isLoading, save, remove };
}
