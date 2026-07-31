import { z } from 'zod';
import * as cheerio from 'cheerio';

// --- Schemas ---

export const scrapeUrlSchema = z.object({
  url: z.string().url().describe('URL сторінки для парсингу'),
  selector: z
    .string()
    .optional()
    .describe('CSS-селектор для вибору елементів (за замовчуванням — body)'),
  extract: z
    .enum(['text', 'html', 'links', 'images', 'products', 'structured'])
    .optional()
    .default('structured')
    .describe('Тип екстракції даних'),
  headers: z.record(z.string()).optional().describe('Додаткові HTTP заголовки'),
});

export const scrapeProductListSchema = z.object({
  url: z.string().url().describe('URL сторінки каталогу товарів'),
  product_selector: z
    .string()
    .describe(
      "CSS-селектор для контейнера одного товару (e.g., '.product-card')",
    ),
  name_selector: z
    .string()
    .describe('CSS-селектор для назви товару всередині контейнера'),
  price_selector: z.string().optional().describe('CSS-селектор для ціни'),
  old_price_selector: z
    .string()
    .optional()
    .describe('CSS-селектор для старої ціни'),
  image_selector: z
    .string()
    .optional()
    .describe('CSS-селектор для зображення (шукає src або data-src)'),
  link_selector: z
    .string()
    .optional()
    .describe('CSS-селектор для посилання на товар (шукає href)'),
  description_selector: z
    .string()
    .optional()
    .describe('CSS-селектор для опису'),
});

export const scrapeProductPageSchema = z.object({
  url: z.string().url().describe('URL сторінки товару'),
  selectors: z
    .object({
      name: z.string().optional().describe('CSS-селектор назви'),
      price: z.string().optional().describe('CSS-селектор ціни'),
      old_price: z.string().optional().describe('CSS-селектор старої ціни'),
      description: z
        .string()
        .optional()
        .describe('CSS-селектор опису (бере HTML)'),
      short_description: z.string().optional(),
      images: z
        .string()
        .optional()
        .describe('CSS-селектор зображень (бере всі src)'),
      sku: z.string().optional().describe('CSS-селектор артикулу'),
      specs_table: z
        .string()
        .optional()
        .describe('CSS-селектор таблиці характеристик'),
    })
    .optional()
    .describe(
      'Мапа CSS-селекторів для полів товару. Якщо не вказано — автоматичне визначення',
    ),
});

// --- Helpers ---

const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function fetchHtml(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const headers = { ...DEFAULT_HEADERS, ...extraHeaders };

  const response = await fetch(url, {
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}`,
    );
  }

  return response.text();
}

function parsePrice(text: string): number | null {
  if (!text) return null;
  // Видалити все крім цифр, крапки, коми
  const cleaned = text.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/**
 * Очищує URL зображення від Google PageSpeed оптимізації
 * Приклад: xluxxpower-6000.jpg.pagespeed.ic.VOClC5kMUH.webp → luxxpower-6000.jpg
 */
function cleanPageSpeedUrl(url: string): string {
  // Видаляємо .pagespeed.ic.HASH.webp або .pagespeed.ic.HASH.jpg
  let cleaned = url.replace(
    /\.pagespeed\.ic\.[^.]+\.(webp|png|jpg|jpeg|gif)/i,
    '.$1',
  );

  // Видаляємо 'x' префікс з назви файлу (PageSpeed додає його)
  cleaned = cleaned.replace(/\/x([^/]+)$/, '/$1');

  // Конвертуємо webp назад в оригінальний формат (jpg за замовчуванням)
  if (cleaned.endsWith('.webp') && !url.includes('.webp')) {
    cleaned = cleaned.replace(/\.webp$/, '.jpg');
  }

  return cleaned;
}

// --- Handlers ---

export async function scrapeUrl(input: z.infer<typeof scrapeUrlSchema>) {
  const html = await fetchHtml(input.url, input.headers);
  const $ = cheerio.load(html);

  const baseUrl = input.url;
  const selector = input.selector || 'body';

  switch (input.extract) {
    case 'text': {
      const text = $(selector).text().trim();
      return {
        content: [{ type: 'text' as const, text: text.substring(0, 50000) }],
      };
    }

    case 'html': {
      const innerHtml = $(selector).html() || '';
      return {
        content: [
          { type: 'text' as const, text: innerHtml.substring(0, 50000) },
        ],
      };
    }

    case 'links': {
      const links: { text: string; href: string }[] = [];
      $(selector)
        .find('a[href]')
        .each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            links.push({
              text: $(el).text().trim(),
              href: resolveUrl(baseUrl, href),
            });
          }
        });
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(links, null, 2) },
        ],
      };
    }

    case 'images': {
      const images: { src: string; alt: string }[] = [];
      $(selector)
        .find('img')
        .each((_, el) => {
          const src =
            $(el).attr('src') ||
            $(el).attr('data-src') ||
            $(el).attr('data-lazy-src');
          if (src) {
            images.push({
              src: cleanPageSpeedUrl(resolveUrl(baseUrl, src)),
              alt: $(el).attr('alt') || '',
            });
          }
        });
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(images, null, 2) },
        ],
      };
    }

    case 'products':
    case 'structured':
    default: {
      // Автоматичне визначення структури сторінки
      const title = $('title').text().trim();
      const h1 = $('h1').first().text().trim();
      const metaDesc =
        $('meta[name="description"]').attr('content')?.trim() || '';

      // Зібрати всі зображення
      const images: string[] = [];
      $(selector)
        .find('img')
        .each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src');
          if (src && !src.includes('logo') && !src.includes('icon')) {
            images.push(cleanPageSpeedUrl(resolveUrl(baseUrl, src)));
          }
        });

      // Зібрати всі посилання
      const links: { text: string; href: string }[] = [];
      $(selector)
        .find('a[href]')
        .each((_, el) => {
          const href = $(el).attr('href');
          const text = $(el).text().trim();
          if (href && text) {
            links.push({ text, href: resolveUrl(baseUrl, href) });
          }
        });

      // Знайти ціни (типові паттерни)
      const priceTexts: string[] = [];
      $('[class*="price"], [class*="Price"], [data-price]').each((_, el) => {
        const text = $(el).text().trim();
        if (text) priceTexts.push(text);
      });

      // Знайти таблиці характеристик
      const tables: Record<string, string>[] = [];
      $('table').each((_, table) => {
        const rows: Record<string, string> = {};
        $(table)
          .find('tr')
          .each((_, row) => {
            const cells = $(row).find('td, th');
            if (cells.length >= 2) {
              const key = $(cells[0]).text().trim();
              const val = $(cells[1]).text().trim();
              if (key && val) rows[key] = val;
            }
          });
        if (Object.keys(rows).length > 0) tables.push(rows);
      });

      const result = {
        url: input.url,
        title,
        h1,
        meta_description: metaDesc,
        images: images.slice(0, 20),
        links: links.slice(0, 50),
        prices: priceTexts,
        spec_tables: tables,
        text_preview: $(selector).text().trim().substring(0, 2000),
      };

      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  }
}

export async function scrapeProductList(
  input: z.infer<typeof scrapeProductListSchema>,
) {
  const html = await fetchHtml(input.url);
  const $ = cheerio.load(html);
  const baseUrl = input.url;

  const products: Record<string, unknown>[] = [];

  $(input.product_selector).each((i, container) => {
    const $item = $(container);

    const product: Record<string, unknown> = {
      index: i,
      name: input.name_selector
        ? $item.find(input.name_selector).text().trim()
        : '',
    };

    if (input.price_selector) {
      const priceText = $item.find(input.price_selector).text().trim();
      product.price = parsePrice(priceText);
      product.price_text = priceText;
    }

    if (input.old_price_selector) {
      const oldText = $item.find(input.old_price_selector).text().trim();
      product.old_price = parsePrice(oldText);
    }

    if (input.image_selector) {
      const $img = $item.find(input.image_selector);
      const src =
        $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
      if (src) product.image = cleanPageSpeedUrl(resolveUrl(baseUrl, src));
    }

    if (input.link_selector) {
      const href = $item.find(input.link_selector).attr('href');
      if (href) product.url = resolveUrl(baseUrl, href);
    }

    if (input.description_selector) {
      product.description = $item
        .find(input.description_selector)
        .text()
        .trim();
    }

    if (product.name) {
      products.push(product);
    }
  });

  return {
    content: [
      {
        type: 'text' as const,
        text:
          `Знайдено ${products.length} товарів на ${input.url}\n\n` +
          JSON.stringify(products, null, 2),
      },
    ],
  };
}

export async function scrapeProductPage(
  input: z.infer<typeof scrapeProductPageSchema>,
) {
  const html = await fetchHtml(input.url);
  const $ = cheerio.load(html);
  const baseUrl = input.url;

  const s = input.selectors;

  // Назва
  const name = s?.name
    ? $(s.name).first().text().trim()
    : $('h1').first().text().trim() ||
      $('[class*="product-title"], [class*="product-name"]')
        .first()
        .text()
        .trim();

  // Ціна
  let price: number | null = null;
  let priceText = '';
  if (s?.price) {
    priceText = $(s.price).first().text().trim();
    price = parsePrice(priceText);
  } else {
    const $price = $(
      '[class*="price"]:not([class*="old"]):not([class*="regular"]):not(del)',
    ).first();
    priceText = $price.text().trim();
    price = parsePrice(priceText);
  }

  // Стара ціна
  let oldPrice: number | null = null;
  if (s?.old_price) {
    oldPrice = parsePrice($(s.old_price).first().text().trim());
  } else {
    const $old = $(
      'del [class*="price"], [class*="old-price"], [class*="regular-price"] del',
    ).first();
    oldPrice = parsePrice($old.text().trim());
  }

  // Опис (HTML)
  let description = '';
  if (s?.description) {
    description = $(s.description).first().html()?.trim() || '';
  } else {
    const descSelectors = [
      '[class*="description"]',
      '[class*="product-content"]',
      '[class*="product-text"]',
      '.woocommerce-product-details__short-description',
      '#tab-description',
    ];
    for (const sel of descSelectors) {
      const html = $(sel).first().html()?.trim();
      if (html && html.length > 50) {
        description = html;
        break;
      }
    }
  }

  // Короткий опис
  let shortDescription = '';
  if (s?.short_description) {
    shortDescription = $(s.short_description).first().text().trim();
  } else {
    const metaDesc =
      $('meta[name="description"]').attr('content')?.trim() || '';
    shortDescription = metaDesc;
  }

  // Зображення
  const images: string[] = [];
  if (s?.images) {
    $(s.images).each((_, el) => {
      const src =
        $(el).attr('src') ||
        $(el).attr('data-src') ||
        $(el).attr('data-large-image') ||
        $(el).attr('data-large_image') || // підтримка data-large_image з підкресленням
        $(el).attr('href');
      if (src) images.push(cleanPageSpeedUrl(resolveUrl(baseUrl, src)));
    });
  } else {
    $(
      '[class*="product-image"] img, [class*="gallery"] img, [class*="woocommerce-product-gallery"] img',
    ).each((_, el) => {
      const src =
        $(el).attr('data-large-image') ||
        $(el).attr('data-large_image') || // підтримка data-large_image з підкресленням
        $(el).attr('data-src') ||
        $(el).attr('src');
      if (src) images.push(cleanPageSpeedUrl(resolveUrl(baseUrl, src)));
    });

    // Якщо не знайшли зображення через img, шукаємо через батьківські <a href>
    if (images.length === 0) {
      $(
        '[class*="product-image"] a[href], [class*="gallery"] a[href], [class*="woocommerce-product-gallery"] a[href]',
      ).each((_, el) => {
        const href = $(el).attr('href');
        // Перевіряємо що це зображення, а не лінк на сторінку
        if (href && /\.(jpg|jpeg|png|gif|webp)$/i.test(href)) {
          images.push(cleanPageSpeedUrl(resolveUrl(baseUrl, href)));
        }
      });
    }
  }

  // SKU
  let sku = '';
  if (s?.sku) {
    sku = $(s.sku).first().text().trim();
  } else {
    sku = $('[class*="sku"]')
      .first()
      .text()
      .replace(/[Аа]ртикул:?\s*/i, '')
      .trim();
  }

  // Таблиця характеристик
  const specs: Record<string, string> = {};
  const specSelector =
    s?.specs_table ||
    '[class*="specifications"] table, [class*="attributes"] table, .woocommerce-product-attributes, [class*="params"] table, [class*="specs"] table';

  $(specSelector)
    .find('tr')
    .each((_, row) => {
      const cells = $(row).find('td, th');
      if (cells.length >= 2) {
        const key = $(cells[0]).text().trim();
        const val = $(cells[1]).text().trim();
        if (key && val) specs[key] = val;
      }
    });

  // Якщо немає таблиці — пробуємо dl/dt/dd
  if (Object.keys(specs).length === 0) {
    $('dl')
      .first()
      .find('dt')
      .each((_, dt) => {
        const key = $(dt).text().trim();
        const val = $(dt).next('dd').text().trim();
        if (key && val) specs[key] = val;
      });
  }

  // Генеруємо slug
  const slug = name
    .toLowerCase()
    .replace(/[^\wа-яіїєґ\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);

  const result = {
    url: input.url,
    name,
    slug,
    sku,
    price,
    old_price: oldPrice,
    price_text: priceText,
    short_description: shortDescription,
    description,
    images: [...new Set(images)],
    specs,
  };

  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
