import { supabase } from './client.js';

const PRODUCT_IMAGES_BUCKET =
  process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || 'product-images';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function isSupabasePublicStorageUrl(url: string): boolean {
  return url.includes('/storage/v1/object/public/');
}

function sanitizeFilename(filename: string): string {
  const normalized = filename
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  if (!normalized) return 'image';

  return normalized.slice(0, 80);
}

function guessExtensionFromContentType(contentType: string | null): string {
  if (!contentType) return '';

  if (contentType.includes('image/jpeg')) return '.jpg';
  if (contentType.includes('image/png')) return '.png';
  if (contentType.includes('image/webp')) return '.webp';
  if (contentType.includes('image/avif')) return '.avif';
  if (contentType.includes('image/gif')) return '.gif';

  return '';
}

function extractFilenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const base = parsed.pathname.split('/').pop() || 'image';
    return sanitizeFilename(decodeURIComponent(base));
  } catch {
    return 'image';
  }
}

async function downloadImage(url: string): Promise<{
  bytes: Uint8Array;
  contentType: string | null;
  filename: string;
}> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; SimplyCMS ContentLoader/1.0; +https://github.com/simplyCMS/simplyCMS)',
      Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${url}`);
  }

  const contentType = response.headers.get('content-type');
  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image too large (${arrayBuffer.byteLength} bytes) for ${url}`
    );
  }

  const bytes = new Uint8Array(arrayBuffer);
  let filename = extractFilenameFromUrl(url);

  const guessedExt = guessExtensionFromContentType(contentType);
  if (guessedExt && !filename.toLowerCase().endsWith(guessedExt)) {
    // Якщо на URL немає розширення — додаємо з Content-Type.
    if (!/\.[a-z0-9]{2,5}$/i.test(filename)) {
      filename = `${filename}${guessedExt}`;
    }
  }

  return { bytes, contentType, filename };
}

async function uploadToPublicBucket(params: {
  bucket: string;
  path: string;
  bytes: Uint8Array;
  contentType: string | null;
}): Promise<string> {
  const { error } = await supabase.storage.from(params.bucket).upload(
    params.path,
    params.bytes,
    {
      upsert: true,
      contentType: params.contentType ?? undefined,
    }
  );

  if (error) {
    throw new Error(`Storage upload failed (${params.bucket}): ${error.message}`);
  }

  const { data } = supabase.storage.from(params.bucket).getPublicUrl(params.path);

  if (!data.publicUrl) {
    throw new Error(`Failed to build public URL for ${params.bucket}/${params.path}`);
  }

  return data.publicUrl;
}

export async function uploadProductImagesFromUrls(params: {
  productId: string;
  urls: string[];
}): Promise<{ images: string[]; warnings: string[] }> {
  const uniqueUrls = [...new Set(params.urls)].filter(Boolean);
  const images: string[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < uniqueUrls.length; index++) {
    const url = uniqueUrls[index];

    if (isSupabasePublicStorageUrl(url)) {
      images.push(url);
      continue;
    }

    try {
      const downloaded = await downloadImage(url);
      const path = `products/${params.productId}/${String(index + 1).padStart(2, '0')}-${downloaded.filename}`;
      const publicUrl = await uploadToPublicBucket({
        bucket: PRODUCT_IMAGES_BUCKET,
        path,
        bytes: downloaded.bytes,
        contentType: downloaded.contentType,
      });
      images.push(publicUrl);
    } catch (e) {
      warnings.push(`Image skipped (${url}): ${(e as Error).message}`);
    }
  }

  return { images, warnings };
}

export async function uploadModificationImagesFromUrls(params: {
  productId: string;
  modificationId: string;
  urls: string[];
}): Promise<{ images: string[]; warnings: string[] }> {
  const uniqueUrls = [...new Set(params.urls)].filter(Boolean);
  const images: string[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < uniqueUrls.length; index++) {
    const url = uniqueUrls[index];

    if (isSupabasePublicStorageUrl(url)) {
      images.push(url);
      continue;
    }

    try {
      const downloaded = await downloadImage(url);
      const path = `products/${params.productId}/modifications/${params.modificationId}/${String(index + 1).padStart(2, '0')}-${downloaded.filename}`;
      const publicUrl = await uploadToPublicBucket({
        bucket: PRODUCT_IMAGES_BUCKET,
        path,
        bytes: downloaded.bytes,
        contentType: downloaded.contentType,
      });
      images.push(publicUrl);
    } catch (e) {
      warnings.push(`Mod image skipped (${url}): ${(e as Error).message}`);
    }
  }

  return { images, warnings };
}
