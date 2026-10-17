import { createContext, useContext } from 'react';
import type { StockStatus } from 'simplycms/contracts';
import type { TranslationStatus } from '../../translations/translation-context';

/** Що знають поля картки про сам товар і серверні помилки його збереження. */
export interface ProductCardContextValue {
  /** `null` — новий товар. */
  readonly productId: string | null;
  /** Власник файлів: `productId` або заздалегідь згенерований id нового товару. */
  readonly entityId: string;
  /** Поточні адреси за мовами (`products.get`). */
  readonly paths: Readonly<Record<string, string>>;
  /** Модифікації, що вже є в БД: ціни й залишки доступні лише для них. */
  readonly persistedModificationIds: ReadonlySet<string>;
  /** Помилки сервера до рядків: модифікація → текст, властивість → текст. */
  readonly modificationErrors: Readonly<Record<string, string>>;
  readonly valueErrors: Readonly<Record<string, string>>;
  readonly clearValueError: (propertyId: string) => void;
  readonly onConflict: (currentVersion: number) => void;
  /** `saveStock` вивів статус цілі (`null` — товар): оновити знімок, а не затерти незбережений ручний вибір. */
  readonly onStockStatus: (
    modificationId: string | null,
    status: StockStatus,
  ) => void;
  /** Адресу мови збережено окремою командою: картка оновлює свій знімок. */
  readonly onPathSaved: (locale: string, path: string) => void;
  /** Статус назви збереженої модифікації за мовою (`products.get`). */
  readonly statusOfModificationName?: (
    id: string,
    locale: string,
  ) => TranslationStatus | undefined;
  /** Статус тексту збереженого значення властивості за мовою. */
  readonly statusOfValueText?: (
    id: string,
    locale: string,
  ) => TranslationStatus | undefined;
}

export const ProductCardContext = createContext<ProductCardContextValue | null>(
  null,
);

export function useProductCard(): ProductCardContextValue {
  const ctx = useContext(ProductCardContext);
  if (!ctx)
    throw new Error('[products] no ProductCardContext in the card tree');
  return ctx;
}
