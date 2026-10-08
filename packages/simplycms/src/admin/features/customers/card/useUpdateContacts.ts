import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { updateCustomerContacts } from 'simplycms/admin-server';
import { ENTITY } from 'simplycms/contracts/entities';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { useT } from 'simplycms/i18n';
import { toast } from 'sonner';
import {
  applyServerValidation,
  formErrorBinding,
} from '../../../lib/apply-server-validation';
import { reportTxError } from '../../../lib/report-tx-error';

const schema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim().pipe(z.email()),
});
export type ContactsValues = z.infer<typeof schema>;
const FIELDS = ['firstName', 'lastName', 'phone', 'email'];

/** Форма контактів і email: помилка `taken` лягає під поле email (Е6г-1). */
export function useUpdateContacts(card: AdminCustomerCard) {
  const t = useT();
  const qc = useQueryClient();
  const form = useForm<ContactsValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: card.firstName ?? '',
      lastName: card.lastName ?? '',
      phone: card.phone ?? '',
      email: card.email,
    },
  });
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await updateCustomerContacts({
        data: {
          userId: card.userId,
          firstName: v.firstName,
          lastName: v.lastName || null,
          phone: v.phone || null,
          email: v.email,
        },
      });
      await qc.invalidateQueries({ queryKey: [ENTITY.profiles] });
      toast.success(t('admin.users.card.contactsSaved'));
    } catch (e) {
      const b = formErrorBinding(form, FIELDS);
      const unmapped = applyServerValidation(e, b.setError, {
        t,
        fieldFor: b.fieldFor,
      });
      if (unmapped === null || unmapped.length > 0) reportTxError(t, e);
    }
  });
  return { form, onSubmit };
}
