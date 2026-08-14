import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePluginT, usePluginTable } from '@simplycms/plugin-sdk';
import { Button } from '@simplycms/ui/button';
import { Input } from '@simplycms/ui/input';
import { Label } from '@simplycms/ui/label';
import { Switch } from '@simplycms/ui/switch';
import { Textarea } from '@simplycms/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@simplycms/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { messages, type FaqKey } from '../messages';
import type { FaqItem } from '../types';

const QUERY_KEY = ['plg_faq_items'] as const;

/**
 * Адмін-сторінка референс-плагіна: CRUD по власній таблиці через
 * `usePluginTable` — жодного прямого Supabase-клієнта (межа довіри §7).
 * Роут `/admin/faq` — дитина layout `/admin` (guard + AdminLayout
 * успадковуються від каркаса адмінки автоматично).
 */
export default function FaqAdmin() {
  const t = usePluginT<FaqKey>(messages);
  const port = usePluginTable<FaqItem>('plg_faq_items');
  const queryClient = useQueryClient();

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [productId, setProductId] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => port.list({ orderBy: 'sort_order' }),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addMutation = useMutation({
    mutationFn: () =>
      port.insert({
        question,
        answer,
        product_id: productId.trim() === '' ? null : productId.trim(),
        sort_order: sortOrder,
        is_active: true,
      }),
    onSuccess: () => {
      setQuestion('');
      setAnswer('');
      setProductId('');
      setSortOrder(0);
      setFormError(null);
      void invalidate();
    },
    onError: (error) => setFormError(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: (item: FaqItem) =>
      port.update(item.id, { is_active: !item.is_active }),
    onSuccess: () => void invalidate(),
    onError: (error) => setFormError(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => port.remove(id),
    onSuccess: () => void invalidate(),
    onError: (error) => setFormError(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('plugin.faq.adminTitle')}</h1>
        <p className="text-muted-foreground">{t('plugin.faq.adminSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('plugin.faq.add')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="faq-question">{t('plugin.faq.question')}</Label>
            <Input
              id="faq-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faq-answer">{t('plugin.faq.answer')}</Label>
            <Textarea
              id="faq-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="faq-product">{t('plugin.faq.productId')}</Label>
              <Input
                id="faq-product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faq-sort">{t('plugin.faq.sortOrder')}</Label>
              <Input
                id="faq-sort"
                type="number"
                value={String(sortOrder)}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          {formError && (
            <p className="text-sm text-destructive">
              {t('plugin.faq.error')}: {formError}
            </p>
          )}
          <Button
            onClick={() => addMutation.mutate()}
            disabled={
              addMutation.isPending ||
              question.trim() === '' ||
              answer.trim() === ''
            }
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {t('plugin.faq.add')}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !items || items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('plugin.faq.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={item.is_active ? '' : 'opacity-60'}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="font-medium">{item.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.answer}
                  </p>
                  {item.product_id && (
                    <code className="mt-1 block text-xs text-muted-foreground">
                      {item.product_id}
                    </code>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`faq-active-${item.id}`}
                      className="text-xs"
                    >
                      {t('plugin.faq.active')}
                    </Label>
                    <Switch
                      id={`faq-active-${item.id}`}
                      checked={item.is_active}
                      onCheckedChange={() => toggleMutation.mutate(item)}
                      disabled={toggleMutation.isPending}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('plugin.faq.delete')}
                    onClick={() => removeMutation.mutate(item.id)}
                    disabled={removeMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
