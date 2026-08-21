/**
 * Структурний сигнал fan-out для класифікатора (інкремент Б.3, блок A.3,
 * план Р3). Чистий модуль: ні браузера, ні IO — лише форма мапи кандидатів,
 * яку вже побудував `classify.mjs`. Винесено окремо саме тому, що канон
 * 150 рядків не дозволяє й далі роздувати `classify.mjs`.
 *
 * Ідея: словник знає слова, структура знає форму сайту. Кандидат-префікс,
 * під яким лежать ≥3 інших кандидати, поводиться як індекс колекції; його
 * бездітні прямі діти — як картки. Це рятує сайти з нейтральними або
 * нестандартними сегментами, де словник мовчить.
 *
 * 🔴 Рахуються ПРЯМІ діти, не всі нащадки: дитина — це pathname, чий
 * батьківський префікс (усе до останнього `/`) дорівнює префіксу. Тому
 * `/shop/men/shirt` дитиною `/shop` НЕ вважається — він дитина `/shop/men`.
 *
 * 🔴 Корінь `/` виключено: інакше «дітьми кореня» була б уся мапа сайту і
 * fan-out спрацьовував би завжди.
 *
 * 🔴 Відома межа сигналу (не ховаємо): структура НЕ відрізняє каталог від
 * будь-якого іншого великого індексу — `/blog` із 12 постами виглядає точно
 * так само, як `/shop` із 12 товарами, і так само забере `listing`.
 * Захист від цього — не евристика, а обовʼязковий діалог фази 1.2 скіла, де
 * запропоновані типи підтверджує людина. Сигнал дає гіпотезу, не вирок.
 */

/**
 * Мінімум прямих дітей-кандидатів, з якого префікс вважається індексом
 * колекції. Три — бо це найменше число, що вже не пояснюється типовою
 * службовою парою («/legal/terms» + «/legal/privacy», «/help/faq» +
 * «/help/shipping»): такі кущі майже завжди дво-елементні, а вітрина
 * категорії з двома товарами практично не трапляється. Поріг свідомо
 * консервативний — краще пропустити сигнал, ніж вигадати каталог.
 */
export const FANOUT_MIN_CHILDREN = 3;

/**
 * Батьківський префікс pathname — усе до останнього `/`.
 * @param {string} pathname нормалізований pathname (без trailing slash)
 * @returns {string | null} `null` для сегмента першого рівня (його батько —
 *   корінь `/`, який із розгляду виключено)
 */
function parentPrefix(pathname) {
  const cut = pathname.lastIndexOf('/');
  return cut <= 0 ? null : pathname.slice(0, cut);
}

/**
 * Структурний розбір набору кандидатів.
 * @param {Map<string, { url: string, anchors: Set<string> }>} candidates мапа
 *   кандидатів `classify.mjs`; використовуються лише ключі (pathname)
 * @returns {Map<string, { listing?: true, product?: true, childCount: number }>}
 *   запис на кожен pathname, крім кореня; `childCount` — кількість ПРЯМИХ
 *   дітей-кандидатів. Порядок ключів — лексикографічний за pathname
 *   (детермінізм: жодної залежності від порядку вставки у вхідній мапі).
 */
export function analyzeStructure(candidates) {
  const pathnames = [...candidates.keys()].filter((p) => p !== '/').sort();

  const childCounts = new Map(pathnames.map((p) => [p, 0]));
  const parents = new Map();
  for (const pathname of pathnames) {
    const parent = parentPrefix(pathname);
    parents.set(pathname, parent);
    // Батько рахує дитину, лише якщо сам є кандидатом: префікс, якого серед
    // зібраних лінків немає, сторінкою може й не бути.
    if (parent !== null && childCounts.has(parent))
      childCounts.set(parent, childCounts.get(parent) + 1);
  }

  const result = new Map();
  for (const pathname of pathnames) {
    const childCount = childCounts.get(pathname);
    const parent = parents.get(pathname);
    const parentFanout = parent !== null ? (childCounts.get(parent) ?? 0) : 0;
    const entry = {};
    if (childCount >= FANOUT_MIN_CHILDREN) entry.listing = true;
    // Лист = кандидат без власних дітей ПІД fan-out-префіксом.
    if (childCount === 0 && parentFanout >= FANOUT_MIN_CHILDREN)
      entry.product = true;
    entry.childCount = childCount;
    result.set(pathname, entry);
  }
  return result;
}

/**
 * Запис evidence зі структурного сигналу — по одному на тип (Р1: форма
 * evidence не змінюється, це ДОДАТКОВИЙ запис вагою +2, як і решта).
 *
 * 🔴 Для листа `count` НЕ віддаємо навмисно: власних дітей у листа рівно
 * нуль за визначенням, а інформативне число (розмір кущa) належить його
 * батькові й у запис форми Р3 не входить. Порожнє поле чесніше за `count: 0`.
 *
 * @param {{ listing?: true, product?: true, childCount: number } | undefined} entry
 * @param {string} type канонічний тип сторінки
 * @returns {{ structural: string, count?: number, source: 'structure' } | null}
 */
export function structuralEvidence(entry, type) {
  if (!entry) return null;
  if (type === 'listing' && entry.listing)
    return {
      structural: 'prefix-fanout',
      count: entry.childCount,
      source: 'structure',
    };
  if (type === 'product' && entry.product)
    return { structural: 'fanout-leaf', source: 'structure' };
  return null;
}
