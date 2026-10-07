import type { PriceEntry } from 'simplycms/contracts';

/** Мінімальний набір полів товару для карток на головній */
export interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
  short_description: string | null;
  stock_status: string | null;
  section: { slug: string } | null;
  /** Розділ — ціль знижок `section` для `priceForCard` (Е6в-11). */
  section_id: string | null;
  /** Ціна за дефолтним типом — серверний HTML до середовища. */
  price: number | null;
  old_price: number | null;
  /** Прайс товару: базу за типом ціни покупця бере `cardPrice`. */
  prices: PriceEntry[];
}

/** Кореневий розділ каталогу (категорія) */
export interface HomeSection {
  id: string;
  name: string;
  slug: string;
}
