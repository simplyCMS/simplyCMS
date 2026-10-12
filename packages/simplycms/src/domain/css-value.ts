/**
 * Значення потрапляє в `<style>`, тож символи, якими можна закрити оголошення
 * чи блок (або відкрити коментар / тег), робили б інʼєкцію можливою. Це
 * deny-list, а не перевірка формату кольору: значення бувають і з БД
 * (токени теми, `overlay_color` банера), тому фільтруємо, а не довіряємо.
 */
const UNSAFE_VALUE = /[;{}<>]|\/\*/;

/**
 * Чи безпечне значення для вставки в CSS. `maxLength` обмежує довжину
 * (за замовчуванням 100); токени теми передають `Infinity`, щоб їхня
 * поведінка не змінилась.
 */
export function isSafeCssValue(
  value: unknown,
  maxLength = 100,
): value is string {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    value.length <= maxLength &&
    !UNSAFE_VALUE.test(value)
  );
}

/**
 * Allow-list формату кольору: hex (3/4/6/8), іменований колір або функція
 * кольору з плоскими аргументами. Дужки всередині заборонені, тож `url(…)`,
 * `var(--x)` і `expression(…)` не проходять: поле накладки банера — колір, а
 * `isSafeCssValue` (deny-list) пропускає `url(https://tracker/…)` у `background`.
 */
const CSS_COLOR_RE =
  /^(?:#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]{3,30}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\([\d\s.,%/+\-a-z]*\))$/i;

export function isSafeCssColor(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 100 &&
    CSS_COLOR_RE.test(value.trim())
  );
}
