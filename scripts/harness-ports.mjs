/**
 * Розбір портів стенду — чиста функція, щоб перевірки жили юнітом без Docker.
 *
 * 🔴 Порти зі списку «bad ports» WHATWG Fetch `fetch` відкидає ще до мережі
 * (`bad port`), тож стенд S3 на такому порту виглядав би як «сховище недоступне»
 * (UPSTREAM:FETCH-BAD-PORT-1). Список — з специфікації Fetch.
 */
export const BAD_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79,
  87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137,
  139, 143, 161, 179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532,
  540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723,
  2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669,
  6679, 6697, 10080,
]);

/**
 * @param {string} name імʼя змінної (для повідомлення)
 * @param {string | undefined} raw значення з env
 * @param {number} fallback
 * @param {{ fetchable?: boolean }} [opts] `fetchable` — порт обслуговує `fetch`-клієнт
 */
export function parsePort(name, raw, fallback, { fetchable = false } = {}) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 65535)
    throw new Error(`${name}=${JSON.stringify(raw)}: очікується порт 1-65535.`);
  const port = Number(raw);
  if (fetchable && BAD_PORTS.has(port))
    throw new Error(
      `${name}=${port}: порт у списку заборонених WHATWG Fetch, \`fetch\` відмовить ` +
        'до мережі (UPSTREAM:FETCH-BAD-PORT-1). Обери інший.',
    );
  return port;
}
