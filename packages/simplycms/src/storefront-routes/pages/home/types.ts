/** Мінімальний набір полів товару для карток на головній */
export interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
  short_description: string | null;
  stock_status: string | null;
  section: { slug: string } | null;
  price: number | null;
  old_price: number | null;
}

/** Кореневий розділ каталогу (категорія) */
export interface HomeSection {
  id: string;
  name: string;
  slug: string;
}
