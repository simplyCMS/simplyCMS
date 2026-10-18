import type { PriceEntry } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';

/** Мінімальний набір полів товару для карток на головній */
export interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  images: ProductImageViewModel[];
  short_description: string | null;
  /** Мова назви / короткого опису, коли текст узято з основної мови (fallback). */
  name_lang?: string | null;
  short_description_lang?: string | null;
  stock_status: string;
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
