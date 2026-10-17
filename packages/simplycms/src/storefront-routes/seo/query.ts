// Серіалізатори query беремо з пакета роутера (реекспорт router-core): це ті
// самі функції, які роутер за замовчуванням застосовує до `location.search`.
import { defaultParseSearch } from '@tanstack/react-router';

/**
 * Захисний інваріант виходу (відкритий редирект): `Location` будь-якого кроку
 * — шлях на ТОМУ САМОМУ origin. Після зняття префікса мови `rest` міг би
 * початися з `//` (`/uk//evil.example` → `//evil.example`), а браузер читає
 * це як адресу іншого сайту. Тому `/` і `\` (URL-парсер трактує `\` як `/`)
 * схлопуються в один `/`, а результат, що все ж не є «один `/`, далі не `/` і
 * не `\`», не віддається взагалі (404). Інваріант на виході, а не латка
 * окремого кроку: він захищає й кроки, які дописує Task 15.
 */
export function sameOriginPath(pathname: string): string | null {
  const collapsed = pathname.replace(/[\\/]{2,}/g, '/').replace(/\\/g, '/');
  return /^\/(?![\\/])/.test(collapsed) || collapsed === '/' ? collapsed : null;
}

/**
 * Query запиту, розібраний як у роутера, АЛЕ токен `mod` береться рядком із сирого
 * `url.search`. Роутер JSON-розбирає значення: `1e5` стає `100000`, 17+ цифр
 * втрачають точність, `true` — булеве; нормалізація, що взяла б розібране значення,
 * 301-ила б на ІНШИЙ токен. Токен — завжди рядок (`entitySearch`), а лапкована форма
 * `?mod=%221e5%22` читається назад рівно як `'1e5'`, тож 301 веде на канонічну форму
 * ТОГО САМОГО токена і без петлі. Масив (`mod=a&mod=b`) роутер відкидає сам.
 */
export function parseQueryKeepingToken(url: URL): Record<string, unknown> {
  const query = defaultParseSearch(url.search) as Record<string, unknown>;
  const raw = url.searchParams.get('mod');
  const parsed = query.mod;
  if (raw !== null && !Array.isArray(parsed) && typeof parsed !== 'string') {
    query.mod = raw;
  }
  return query;
}
