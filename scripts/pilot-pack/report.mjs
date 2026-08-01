/**
 * Підсумок пілота: друк результатів гейтів і код виходу.
 *
 * Винесено з `pilot-pack.mjs` окремим модулем — там залишається лише
 * оркестрація режимів, без форматування виводу.
 */

/**
 * @param {[string, { ok: boolean; details: string[] }][]} results
 * @param {{ scope: string }} opts опис набору гейтів для підсумкового рядка
 * @returns {number} код виходу процесу
 */
export function report(results, { scope }) {
  console.log('\n[1m═ Підсумок пілота ═[0m');
  let failed = 0;
  for (const [name, { ok, details }] of [...results].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    console.log(`\nGate ${name}: ${ok ? '[32mPASS[0m' : '[31mFAIL[0m'}`);
    for (const line of details) console.log(`  ${line}`);
    if (!ok) failed += 1;
  }
  console.log(
    failed === 0
      ? `\n[32mПілот пройдено: ${scope} зелені.[0m`
      : `\n[31mПілот НЕ пройдено: провалено гейтів — ${failed}.[0m`,
  );
  return failed === 0 ? 0 : 1;
}
