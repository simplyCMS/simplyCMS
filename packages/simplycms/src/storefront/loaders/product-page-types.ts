import type { SanitizedHtml } from 'simplycms/contracts';
import type { SectionRef } from './entities/section';
import type { IndexPolicy } from '../seo/index-policy';

/** Адреса сторінки товару: мова запиту + шлях з реєстру (без префікса мови). */
export type ProductAddress = { locale: string; path: string };

/** Текстові поля сторінки, які можуть прийти з fallback на основну мову. */
export const FALLBACK_FIELDS = [
  'name',
  'short_description',
  'description',
] as const;
export type FallbackField = (typeof FALLBACK_FIELDS)[number];

/** Мовний контекст сторінки товару: що показано, чи перекладено і як індексувати. */
export type ProductPage = {
  locale: string;
  primary: string;
  /** Поточна адреса товару в цій мові. */
  path: string;
  /** SEO-предикат «перекладено» (майстер §3.4). */
  isTranslated: boolean;
  /** Поля, чий текст узято з основної мови (колонка проєкції `fallback_fields`): у розмітці вони мають `lang=<основна>`. */
  fallbackFields: FallbackField[];
  seo: IndexPolicy;
};

/** Ядро сторінки: нетекстові колонки, розділ, текст мови запиту, мовний контекст. */
export type ProductPageBase = {
  product: {
    id: string;
    section_id: string | null;
    is_active: boolean;
    is_featured: boolean;
    created_at: Date;
    updated_at: Date;
    images: unknown;
    has_modifications: boolean | null;
    sku: string | null;
    stock_status: 'in_stock' | 'out_of_stock' | 'on_order';
  };
  section: SectionRef | null;
  text: {
    name: string;
    short_description: string | null;
    description: SanitizedHtml | null;
    meta_title: string | null;
    meta_description: string | null;
  };
  page: ProductPage;
};
