#!/usr/bin/env node

/**
 * 🔴 DECOMMISSIONED (рішення B2/B13, амендмент спеки 2026-08-23).
 *
 * Скрипт застосовував `supabase/migrations/` через Supabase CLI (`supabase
 * link` + `db push`) і потім перегенеровував `supabase/types.ts`. Обидві
 * половини вмерли разом зі стеком:
 *
 *   • теки `supabase/migrations/` більше немає — канон ядра переїхав у
 *     `packages/simplycms/migrations/` (baseline + сід замість 33 файлів
 *     історії демо-магазину);
 *   • Supabase CLI виходить із тулчейна: контрактом v2 є чистий Postgres, а
 *     Supabase — лише один із можливих провайдерів.
 *
 * Скрипт лишається файлом-надгробком, а не тихо видаляється: `pnpm
 * db:migrate` глибоко вшитий у пам'ять і в доки, і мовчазне «command not
 * found» відправило б розробника шукати причину не там. Повний знос — К1′б/К6
 * (роадмап платформи), разом із теками `supabase/` і `db:generate-types`.
 */

console.error('\n❌ `pnpm db:migrate` виведено з експлуатації (B2/B13).\n');
console.log('Стек v2 не застосовує міграції через Supabase CLI. Що замість:');
console.log(
  '  1. pnpm db:diff <name>   — schema.ts → packages/simplycms/migrations/NNNN_<name>.sql;',
);
console.log('  2. ревʼю SQL людиною (крок обовʼязковий, як і був);');
console.log(
  '  3. pnpm test:schema      — накат усього канону на чисту БД харнеса;',
);
console.log(
  '  4. накат на цільову БД — інструментом оточення (psql/деплой), канон у\n' +
    '     packages/simplycms/migrations/ і є повним, упорядкованим набором.\n',
);
console.log(
  '🔴 Живу БД цей репозиторій більше не чіпає автоматично — це рішення людини.\n',
);
process.exit(1);
