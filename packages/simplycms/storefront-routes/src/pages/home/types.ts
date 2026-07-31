/** Мінімальний набір полів товару для карток на головній */
export interface HomeProduct {
  id: string;
  name: string;
  slug: string;
  images: string[];
  short_description: string | null;
  stock_status: string | null;
  section: { slug: string } | null;
}

/** Кореневий розділ каталогу (категорія) */
export interface HomeSection {
  id: string;
  name: string;
  slug: string;
}
