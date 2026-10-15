// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCALES_GLOBAL,
  readClientLocaleSet,
  serializeLocalesScript,
} from '../script';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>)[LOCALES_GLOBAL];
});

/** Виконати згенерований скрипт так, як це робить браузер у `<head>`. */
const run = (code: string) => new Function(code)();

describe('serializeLocalesScript / readClientLocaleSet (Д2)', () => {
  it('кругова передача: скрипт у head → набір мов клієнта', () => {
    run(serializeLocalesScript({ primary: 'uk', published: ['uk', 'en'] }));
    expect(readClientLocaleSet()).toEqual({
      primary: 'uk',
      published: ['uk', 'en'],
      known: ['uk', 'en'],
    });
  });

  it('"<" екранується: код мови не закриє тег script', () => {
    const code = serializeLocalesScript({
      primary: 'uk',
      published: ['</script><b>'],
    });
    expect(code).not.toContain('</script>');
    run(code);
    expect(readClientLocaleSet().published).toEqual(['</script><b>']);
  });

  it('без глобала клієнт відмовляє гучно, з підказкою про кореневий роут', () => {
    expect(() => readClientLocaleSet()).toThrow(/serializeLocalesScript/);
  });

  it('зіпсований глобал (не набір мов) теж відмовляє', () => {
    (window as unknown as Record<string, unknown>)[LOCALES_GLOBAL] = {
      primary: 1,
    };
    expect(() => readClientLocaleSet()).toThrow(/missing/);
  });
});
