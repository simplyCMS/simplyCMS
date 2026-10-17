import { and, eq } from 'drizzle-orm';
import { languages, products } from 'simplycms/schema';

/**
 * ЄДИНИЙ предикат видимості сторінки товару: мова `published` і товар `is_active`.
 * Ним користуються лоадер сторінки, sitemap і резолв історичної адреси: інакше 301
 * з історії неактивного товару чи неопублікованої мови розкрив би його поточну
 * адресу, а сторінка за нею все одно дала б 404. Умова накладається на запит, що
 * вже приєднав `languages` і `products`.
 */
export const pageVisible = () =>
  and(eq(languages.status, 'published'), eq(products.isActive, true));
