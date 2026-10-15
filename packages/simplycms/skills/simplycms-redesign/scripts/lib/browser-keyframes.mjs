/**
 * Канал `@keyframes` motion-капчера, що виконується В БРАУЗЕРІ (план Р1).
 * Окремий модуль — за тим самим правилом, що `browser-reveal.mjs`/
 * `browser-hover.mjs`: один канал = один файл, а `browser-motion.mjs` уже
 * близько до канонних 150 рядків. Функція САМОДОСТАТНЯ: Playwright серіалізує
 * лише її `toString()` у сторінковий контекст, тож жодних замикань на модульний
 * скоуп (звідси копія константи всередині).
 */

/**
 * Імена `@keyframes` документа + ЧЕСНИЙ лічильник недоступних аркушів (Р1):
 * cross-origin stylesheet кидає `SecurityError` на `.cssRules`, і мовчазний
 * дроп приховав би від автора теми цілий пласт анімацій.
 */
export function browserKeyframes() {
  const KEYFRAMES_RULE = 7; // CSSRule.KEYFRAMES_RULE — копія, не замикання
  const names = new Set();
  let inaccessibleSheets = 0;

  // Рекурсія — бо `@keyframes` цілком легально живе всередині `@media`/
  // `@supports`, і плаский обхід верхнього рівня їх не побачив би.
  //
  // 🔴 `@import` (CSSImportRule) власного `cssRules` НЕ має — правила лежать у
  // `rule.styleSheet.cssRules`, а в `document.styleSheets` імпортований аркуш
  // окремим записом не зʼявляється. Без цієї гілки він губився б ЦІЛКОМ: ані
  // імен (same-origin), ані лічильника (cross-origin). Тому і ЧИТАННЯ
  // вкладених правил, і рекурсія — всередині `try`: на чужому походженні
  // кидає вже сам доступ до `.cssRules`, і саме він дає чесну дірку.
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.type === KEYFRAMES_RULE && rule.name) {
        names.add(rule.name);
        continue;
      }
      const imported = 'styleSheet' in rule;
      try {
        const nested = imported ? rule.styleSheet?.cssRules : rule.cssRules;
        if (nested) walk(nested);
        // Імпорт без доступних правил (не завантажився / порожній) — теж дірка.
        else if (imported) inaccessibleSheets += 1;
      } catch {
        inaccessibleSheets += 1;
      }
    }
  };

  for (const sheet of document.styleSheets) {
    let rules = null;
    try {
      rules = sheet.cssRules;
    } catch {
      rules = null;
    }
    if (!rules) {
      inaccessibleSheets += 1;
      continue;
    }
    walk(rules);
  }

  return { names: [...names].sort(), inaccessibleSheets };
}
