// Конфіг-типи рушія (SEO, медіа-опції).

export interface SeoConfig {
  defaultTitle: string;
  titleTemplate: string;
  defaultDescription: string;
  ogImage?: string;
  twitterHandle?: string;
}

export interface ImageOpts {
  width?: number;
  height?: number;
  quality?: number;
  format?: "webp" | "avif" | "jpeg" | "png" | "auto";
  resize?: "cover" | "contain" | "fill";
}
