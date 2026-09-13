import { expect } from 'vitest';

/**
 * Кожен текстовий контрол форми має `id` і `<label for>` (К2-Е0, Е0-4):
 * без цього скрінрідери й `getByLabel` Playwright поля не знаходять, а
 * лейбл-сусід без `htmlFor` — не звʼязок. Radio/checkbox тут не рахуються:
 * їхній звʼязок стереже ESLint-зона (крок 3), а поведінковий асерт по DOM
 * тримає саме текстові поля — ті, що заповнює live-smoke.
 */
export function expectLabelledControls(container: HTMLElement): void {
  const controls = container.querySelectorAll<HTMLElement>(
    'input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]), select, textarea',
  );
  expect(controls.length).toBeGreaterThan(0);
  for (const control of controls) {
    expect(
      control.id,
      `контрол без id: ${control.outerHTML.slice(0, 80)}`,
    ).not.toBe('');
    expect(
      container.querySelector(`label[for="${control.id}"]`),
      `немає label[for="${control.id}"]`,
    ).not.toBeNull();
  }
}
