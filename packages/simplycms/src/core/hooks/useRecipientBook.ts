import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteMyRecipient,
  getMyRecipients,
  saveMyRecipient,
  type RecipientRow,
} from '../lib/user-recipients';

export type { RecipientRow };

/** Поля форми отримувача: без `id` — створення, з `id` — редагування. */
export interface RecipientFormInput {
  id?: string | null;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  city: string;
  address: string;
  notes: string | null;
  isDefault: boolean;
}

/** Ключ книги отримувачів — один на застосунок (див. `useAddressBook`). */
export const RECIPIENT_BOOK_KEY = ['recipient-book'] as const;

/**
 * Книга отримувачів покупця: список + збереження + видалення.
 *
 * 🔴 `userId` у параметрах немає — ідентичність бере серверна сесія.
 */
export function useRecipientBook(enabled: boolean) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: RECIPIENT_BOOK_KEY });

  const list = useQuery({
    queryKey: RECIPIENT_BOOK_KEY,
    queryFn: (): Promise<RecipientRow[]> => getMyRecipients(),
    enabled,
  });

  const save = useMutation({
    mutationFn: (input: RecipientFormInput): Promise<string | null> =>
      saveMyRecipient({ data: input }),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string): Promise<boolean> =>
      deleteMyRecipient({ data: { id } }),
    onSuccess: invalidate,
  });

  return { recipients: list.data, isLoading: list.isLoading, save, remove };
}
