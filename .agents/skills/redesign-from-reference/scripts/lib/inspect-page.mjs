/**
 * Інспекція вже завантаженої сторінки (задача §2.A, план Р1b). Виокремлено з
 * `inspect.mjs` (канон ≤150 рядків) — той лишається тонким CLI (аргументи +
 * launch chromium + `page.goto`); тут — скріншоти + світлий/темний семпл і
 * запис `inspection.json`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scrollThrough } from './browser.mjs';
import { sweepHover } from './hover-sweep.mjs';
import { captureMotion, captureReveal } from './motion.mjs';
import {
  captureScreenshots,
  samplePalette,
  VIEWPORTS,
  VIEWPORT_HEIGHT,
} from './sample.mjs';

// 2 (Фаза 1 інкремента Б.2) — додано верхньорівневу секцію `motion`. 🔴 Це
// НЕ та сама версія, що `SCHEMA_VERSION` у `lib/map.mjs`: там версіонується
// `tokens-proposal.json`, і вона лишається 1 (motion у токени не мапиться).
const SCHEMA_VERSION = 2;

/** Порівняння світлого/темного семплу за фоном+текстом — чесний `darkDetected`. */
function paletteSignature(colors) {
  return colors
    .filter((c) => c.role === 'background' || c.role === 'text')
    .map((c) => c.value)
    .sort()
    .join(',');
}

/**
 * Інспектувати вже завантажену сторінку (навігацію робить викликач: CLI —
 * `page.goto`, тест-фікстура — `page.setContent`): скріншоти + світлий +
 * опційно темний семпл (`dark`). Пише `inspection.json` в `out`, повертає
 * той самий обʼєкт.
 */
export async function inspectPage(page, { url, out, dark }) {
  mkdirSync(out, { recursive: true });

  // Р1b: `captureScreenshots` лишає сторінку на останньому viewport циклу
  // (мобільний, 390px) — без явного повернення на десктоп палітра де-факто
  // мобільна: десктопні секції (`display:none` на вузькому лейауті) мають
  // area<=0 і випадають із семплу. Той самий viewport — і для light-, і для
  // dark-проходу, інакше вони порівнюють різні лейаути.
  const sampleViewport = { width: VIEWPORTS.desktop, height: VIEWPORT_HEIGHT };

  // 🔴 Р4: reveal — ПЕРШИМ і окремим проходом, ДО скріншотів. Далі
  // `scrollThrough` відпрацює ще щонайменше пʼять разів, а reveal-once секція
  // після першого проходу лишається розкритою назавжди: у будь-якому
  // пізнішому вимірі дельта opacity/transform тотожно нульова.
  await page.setViewportSize(sampleViewport);
  const reveal = await captureReveal(page);

  const viewports = await captureScreenshots(page, out);
  await page.setViewportSize(sampleViewport);
  await scrollThrough(page);
  // 🔴 Р5: ховер-прохід — ПІСЛЯ скріншотів (курсор не має потрапити в кадр) і
  // ДО семплу палітри. `sweepHover` прибирає ховер за собою (курсор у
  // нейтральну точку), інакше стан однієї кнопки протік би в кольори сайту.
  const hover = await sweepHover(page);
  const light = await samplePalette(page);
  const motion = await captureMotion(page, { reveal, hover });

  let darkColors = null;
  if (dark) {
    await page.emulateMedia({ colorScheme: 'dark' });
    await scrollThrough(page); // лейаут міг перерендеритись під темною темою
    const darkSample = await samplePalette(page);
    await page.emulateMedia({ colorScheme: 'light' });
    if (paletteSignature(light.colors) !== paletteSignature(darkSample.colors))
      darkColors = darkSample.colors;
  }
  const darkDetected = darkColors !== null;

  const inspection = {
    schemaVersion: SCHEMA_VERSION,
    url,
    viewports,
    sampleViewport,
    colors: light.colors,
    fonts: light.fonts,
    radius: light.radius,
    radiusDropped: light.radiusDropped,
    shadows: light.shadows,
    spacing: light.spacing,
    fontStylesheets: light.fontStylesheets,
    motion,
    darkDetected,
    ...(darkColors ? { dark: { colors: darkColors } } : {}),
  };

  writeFileSync(
    join(out, 'inspection.json'),
    JSON.stringify(inspection, null, 2),
    'utf8',
  );
  return inspection;
}
