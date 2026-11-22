// Конфіг-типи рушія (медіа-опції). `SeoConfig` прибрано разом із
// `ConfigProvider.seo`: SEO-дані магазину — профіль у БД.

export interface ImageOpts {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'auto';
  resize?: 'cover' | 'contain' | 'fill';
}
