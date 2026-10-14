import { it } from 'vitest';

// Тримає прогін живим: пізню помилку воркера збирає vitest лише поки живий
// хоч один файл — як сусідні файли в повному `pnpm test`.
it('тримає прогін', async () => {
  await new Promise((r) => setTimeout(r, 4000));
}, 10_000);
