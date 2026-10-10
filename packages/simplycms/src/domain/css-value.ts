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
