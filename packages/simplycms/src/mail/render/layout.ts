/** Екранування для HTML-версії листа: `storeName` і URL — довільні рядки. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Абзац HTML-листа з уже екранованим вмістом. */
export const paragraph = (html: string): string => `<p>${html}</p>`;

/** Посилання-дія: `url` і підпис екрануються тут, викликач передає сирі. */
export const linkParagraph = (url: string, label: string): string =>
  paragraph(`<a href="${escapeHtml(url)}">${escapeHtml(label)}</a>`);

/**
 * Спільна обгортка HTML-листів. Мінімальна свідомо: поштові клієнти ріжуть
 * стилі, а будь-яке оформлення — справа теми/магазину, не ядра.
 */
export function layout(storeName: string, bodyHtml: string): string {
  return (
    `<!doctype html><html><body>` +
    `<h2>${escapeHtml(storeName)}</h2>${bodyHtml}` +
    `</body></html>`
  );
}
