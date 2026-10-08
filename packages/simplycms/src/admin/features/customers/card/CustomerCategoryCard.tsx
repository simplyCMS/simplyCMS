import { useState } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { useCollection, userCategoriesCollection } from 'simplycms/admin-data';
import { useT } from 'simplycms/i18n';
import type { AdminCustomerCard } from 'simplycms/contracts/objects';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { Label } from 'simplycms/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { Switch } from 'simplycms/ui/switch';
import { Textarea } from 'simplycms/ui/textarea';
import CustomerHistoryList from './CustomerHistoryList';
import { useAssignCategory } from './useAssignCategory';

/** Категорія покупця: ручне призначення з причиною та закріпленням + історія. */
export default function CustomerCategoryCard({
  card,
}: {
  readonly card: AdminCustomerCard;
}) {
  const t = useT();
  const assign = useAssignCategory(card.userId);
  const collection = useCollection(userCategoriesCollection);
  const { data: categories } = useLiveQuery({
    query: (q) => q.from({ c: collection }),
  });
  const [categoryId, setCategoryId] = useState(card.category?.id ?? '');
  const [locked, setLocked] = useState(card.category?.locked ?? false);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    // Причина обовʼязкова на сервері (min 1): лишаємо помилку в полі.
    if (!categoryId || !reason.trim()) return setMissing(true);
    setMissing(false);
    setPending(true);
    if (await assign({ categoryId, reason: reason.trim(), locked }))
      setReason('');
    setPending(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.categoryAndRole')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cc-category">{t('admin.users.userCategory')}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="cc-category">
              <SelectValue placeholder={t('admin.users.pickCategory')} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="cc-lock" checked={locked} onCheckedChange={setLocked} />
          <Label htmlFor="cc-lock">{t('admin.users.card.lockCategory')}</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('admin.users.card.lockHint')}
        </p>
        <div className="space-y-2">
          <Label htmlFor="cc-reason">{t('admin.users.card.reason')}</Label>
          <Textarea
            id="cc-reason"
            value={reason}
            maxLength={500}
            aria-invalid={missing}
            onChange={(e) => setReason(e.target.value)}
          />
          {missing && (
            <p role="alert" className="text-xs text-destructive">
              {t('admin.users.card.reasonRequired')}
            </p>
          )}
        </div>
        <Button disabled={pending} onClick={submit}>
          {t('admin.users.card.assign')}
        </Button>
        <h3 className="pt-2 font-medium">{t('admin.users.categoryHistory')}</h3>
        <CustomerHistoryList history={card.history} />
      </CardContent>
    </Card>
  );
}
