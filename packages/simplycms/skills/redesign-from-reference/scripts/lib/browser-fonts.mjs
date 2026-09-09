/**
 * Голосування за шрифт-сімʼї, що виконується В БРАУЗЕРІ (план Р7, Фаза 3).
 * Окремий модуль, а не доважок до `browser-sample.mjs`: той файл уперся в
 * канонні 150 рядків, а вага сімʼї потребує власного обходу текстових вузлів.
 * Функція САМОДОСТАТНЯ — Playwright серіалізує лише її `toString()` у
 * сторінковий контекст, тож жодних замикань на модульний скоуп (звідси копії
 * констант замість імпортів). Node-обгортка — `samplePalette` у `sample.mjs`.
 */

/**
 * Знімок шрифт-сімʼї заголовків і body-тексту.
 *
 * 🔴 Р7: вага сімʼї — СУМА довжин тексту, а не кількість елементів. Частота
 * ламалася на живому референсі: численні дрібні `<span>`-мітки (ціни, бейджі,
 * хлібні крихти) у моно- чи акцидентній сімʼї перебивали кілька довгих
 * body-абзаців, і `fonts.body` віддавав шрифт міток замість шрифту читання.
 */
export function browserFonts(limit) {
  const NODE_TEXT_CAP = 400; // ліміт внеску ОДНОГО вузла, символів
  const TEXT_NODE = 3; // Node.TEXT_NODE — копія, бо замикань тут немає

  // 🔴 Пастка вкладеності: `textContent` батька містить текст усіх дітей, тож
  // `<p><span>x</span></p>` зарахував би «x» двічі — і сімʼї абзацу, і сімʼї
  // спана. Рахуємо лише ПРЯМІ текстові вузли: так сторінка ділиться між
  // елементами без перетину, і сума ваг дорівнює довжині видимого тексту.
  function directTextLength(el) {
    let length = 0;
    for (const node of el.childNodes)
      if (node.nodeType === TEXT_NODE) length += node.nodeValue.trim().length;
    // Ліміт на вузол: 400 символів — це вже кілька речень, тобто повноцінний
    // блок тексту. Далі внесок не росте, щоб один довжелезний абзац (стаття,
    // футер-дисклеймер) не монополізував голосування власною сімʼєю.
    return Math.min(length, NODE_TEXT_CAP);
  }

  function bumpFont(map, style, textLength) {
    const key = style.fontFamily;
    const e = map.get(key) ?? {
      family: key,
      weight: style.fontWeight,
      sizePx: parseFloat(style.fontSize),
      count: 0,
      textLength: 0,
    };
    e.count += 1;
    e.textLength += textLength;
    map.set(key, e);
  }

  const headingFonts = new Map();
  const bodyFonts = new Map();

  for (const el of [...document.querySelectorAll('body *')].slice(0, limit)) {
    const rect = el.getBoundingClientRect();
    if (rect.width * rect.height <= 0) continue; // невидиме не голосує

    const isHeading = /^H[1-3]$/.test(el.tagName);
    if (!isHeading && !['P', 'SPAN', 'LI'].includes(el.tagName)) continue;
    // Гейт «елемент узагалі текстовий» лишається по `textContent` (як було до
    // Р7): `<h1><span>…</span></h1>` має рахуватись заголовком, хоч прямого
    // тексту в ньому немає. Ваги такий вузол дає нуль — вирішить tie-break.
    if (!el.textContent || !el.textContent.trim()) continue;

    const style = getComputedStyle(el);
    bumpFont(isHeading ? headingFonts : bodyFonts, style, directTextLength(el));
  }

  /** Переможець — за сумарною вагою; частота лишається tie-break-ом (Р7). */
  function topFont(map) {
    let best = null;
    for (const e of map.values()) {
      if (!best) best = e;
      else if (e.textLength > best.textLength) best = e;
      else if (e.textLength === best.textLength && e.count > best.count)
        best = e;
    }
    return best
      ? { family: best.family, weight: best.weight, sizePx: best.sizePx }
      : null;
  }

  return { heading: topFont(headingFonts), body: topFont(bodyFonts) };
}
