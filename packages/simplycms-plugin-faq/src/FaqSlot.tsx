import { useEffect, useState } from 'react';
import {
  usePluginConfig,
  usePluginT,
  usePluginTable,
} from 'simplycms/plugin-sdk';
import { messages, type FaqKey } from './messages';
import { settings } from './settings';
import type { FaqItem } from './types';

/**
 * Слот `product.detail.after`: FAQ до товару + загальні питання
 * (без `product_id`). Кількість видимих — з налаштувань плагіна
 * (`usePluginConfig`), редагованих у адмінці.
 *
 * Стійкість до відсутньої міграції навмисна: якщо `plg_faq_items` ще не
 * накатили (`simplycms db:diff --write` — крок власника), запит упаде, і
 * слот рендерить null — сторінка товару не страждає.
 */
export function FaqSlot({ context }: { context?: unknown }) {
  const t = usePluginT<FaqKey>(messages);
  const port = usePluginTable<FaqItem>('plg_faq_items');
  const { config } = usePluginConfig('faq', settings);
  const [items, setItems] = useState<FaqItem[] | null>(null);

  const productId = (context as { product?: { id?: string } } | undefined)
    ?.product?.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await port.list({
          eq: { is_active: true },
          orderBy: 'sort_order',
        });
        if (cancelled) return;
        setItems(
          rows.filter(
            (row) => row.product_id === null || row.product_id === productId,
          ),
        );
      } catch {
        // Таблиці ще немає (міграцію не накатили) — слот мовчить.
        if (!cancelled) setItems(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [port, productId]);

  if (!items || items.length === 0 || !config) return null;

  return (
    <section className="mt-8 rounded-lg border bg-card p-6 text-card-foreground">
      <h2 className="text-lg font-semibold">{t('plugin.faq.title')}</h2>
      <dl className="mt-4 space-y-4">
        {items.slice(0, config.maxVisible).map((item) => (
          <div key={item.id}>
            <dt className="font-medium">{item.question}</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
