import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO, eslint } from '../tier-boundary/lint';

/**
 * Зона в справжньому `eslint.config.mjs`: правило діє на всі теки репо
 * (ядро, теми, плагіни, host), а виняток — рівно сам `RichHtml` і явний список
 * із причинами. Без цього файлу негативний контроль самого правила
 * (`no-dangerously-set-inner-html.test.ts`) доводив би лише правило, а не його
 * підключення до конфігу.
 */
const RULE_ID = 'simplycms-rich-html/no-dangerously-set-inner-html';
const CODE =
  'export const A = () => <div dangerouslySetInnerHTML={{ __html: "x" }} />;\n';

async function errorsAt(filePath: string) {
  const [result] = await eslint.lintText(CODE, {
    filePath: join(REPO, filePath),
    warnIgnored: true,
  });
  return (result?.messages ?? []).filter((m) => m.ruleId === RULE_ID);
}

describe('зона no-dangerously-set-inner-html у eslint.config.mjs', () => {
  it.each([
    'packages/simplycms/src/reviews-ui/__fixture.tsx',
    'packages/simplycms/src/admin/pages/__fixture.tsx',
    'themes/default/views/__fixture.tsx',
    'packages/simplycms-theme-solarstore/src/__fixture.tsx',
    'plugins/hello-world/__fixture.tsx',
    'src/routes/my/__fixture.tsx',
  ])('валить у %s', async (filePath) => {
    expect(await errorsAt(filePath)).toHaveLength(1);
  });

  it.each([
    'packages/simplycms/src/ui/rich-html.tsx',
    'packages/simplycms/src/ui/chart.tsx',
    'packages/simplycms/src/storefront-routes/shells/ThemeTokens.tsx',
    'src/routes/__root.tsx',
  ])('виняток із причиною: %s', async (filePath) => {
    expect(await errorsAt(filePath)).toHaveLength(0);
  });
});
