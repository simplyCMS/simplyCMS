// Форматування ціни всередині React-дерева: локаль і валюта беруться з
// EngineContext, а не хардкодяться на кол-сайті.
//
// 🔴 Чому хук живе тут, а не в simplycms/domain: сама функція `formatPrice`
// чиста (T1) і потрібна також поза React — у SSR-генераторах SEO. Реактивний
// доступ до конфігу магазину дає лише `useEngine()`, який живе в цьому пакеті
// (T2). Ребро react-query → domain іде вниз по тірах (T2 → T1), тож зайвої
// звʼязності не вносить.

import { useCallback } from 'react';
import { formatPrice, type FormatPriceOptions } from 'simplycms/domain/money';
import { useEngine } from './EngineProvider';

/**
 * Повертає форматувальник ціни, налаштований локаллю й валютою МАГАЗИНУ
 * (`simplycms.config.ts` → `EngineContext.config`).
 *
 * 🔴 До цього хука чотирнадцять кол-сайтів мали власну копію
 * `new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' })` —
 * тобто конфіг магазину ігнорувався, а символ валюти брався з CLDR рушія й
 * розходився між SSR і клієнтом (гідраційний мисматч). Обидві проблеми
 * лікуються тим, що форматування стало ОДНИМ механізмом.
 */
export function useFormatPrice(): (
  value: number,
  options?: FormatPriceOptions,
) => string {
  const { config } = useEngine();

  // Мемоїзуємо по полях, а не по обʼєкту `config`: EngineContext збирається
  // наново на кожному рендері host-провайдера, тож посилання нестабільне.
  const { locale, currency } = config;

  return useCallback(
    (value: number, options?: FormatPriceOptions) =>
      formatPrice(value, { locale, currency }, options),
    [locale, currency],
  );
}
