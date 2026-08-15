/**
 * Фікстурний `inspection.json`-подібний обʼєкт (Фаза 1, задача §2.A, план Р4).
 *
 * Синтетичний, але формою ІДЕНТИЧНИЙ реальному виводу `inspect.mjs` (Фаза 2) —
 * ту саму фікстуру Фаза 2 звірить проти `tests/fixtures/design-import/
 * reference.html`, який вона зробить (кольори/шрифти/radius/googleapis-лінки
 * нижче МАЮТЬ збігтись 1:1 з тим HTML, коли він зʼявиться). Контракт між
 * скриптами перевіряється незалежно від наявності браузера (задача §2, «наскрізний
 * юніт БЕЗ браузера»).
 */

export const sampleInspection = {
  schemaVersion: 1,
  url: 'https://reference.example/',
  viewports: { desktop: 1440, tablet: 768, mobile: 390 },

  // role: 'background' | 'text' | 'border'; interactive — хоча б один
  // семпл-джерело був кнопкою/лінком (сигнал для мапінгу `primary`).
  colors: [
    { value: '#ffffff', role: 'background', frequency: 900, area: 950000 },
    { value: '#cccccc', role: 'background', frequency: 300, area: 180000 },
    { value: '#18181b', role: 'text', frequency: 700, area: 40000 },
    {
      value: '#2563eb',
      role: 'background',
      frequency: 45,
      area: 6000,
      interactive: true,
    },
    { value: '#7c3aed', role: 'background', frequency: 20, area: 3000 },
    { value: '#fbbf24', role: 'background', frequency: 5, area: 400 },
    { value: '#e4e4e7', role: 'border', frequency: 250, area: 15000 },
  ],

  fonts: {
    heading: {
      family: "'Manrope', system-ui, sans-serif",
      weight: '700',
      sizePx: 32,
    },
    body: {
      family: "'Inter', system-ui, sans-serif",
      weight: '400',
      sizePx: 16,
    },
  },

  radius: [
    { valuePx: 8, frequency: 120 },
    { valuePx: 4, frequency: 20 },
  ],

  shadows: ['0 1px 2px rgba(0, 0, 0, 0.05)'],
  spacing: [4, 8, 16, 24, 32],

  // Googleapis-лінки документа — підтвердження сімей для `fonts`-пропозиції (Р7).
  fontStylesheets: [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&display=swap',
  ],

  darkDetected: true,
  dark: {
    colors: [
      { value: '#09090b', role: 'background', frequency: 900, area: 950000 },
      { value: '#27272a', role: 'background', frequency: 300, area: 180000 },
      { value: '#fafafa', role: 'text', frequency: 700, area: 40000 },
      {
        value: '#3b82f6',
        role: 'background',
        frequency: 45,
        area: 6000,
        interactive: true,
      },
      { value: '#a78bfa', role: 'background', frequency: 20, area: 3000 },
      { value: '#3f3f46', role: 'border', frequency: 250, area: 15000 },
    ],
  },
};
