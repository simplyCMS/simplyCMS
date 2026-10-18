// UPSTREAM:START-SFN-404-1 — жива проба на СПРАВЖНЬОМУ магазині пілота з базою server functions,
// з якою магазин збирається за замовчуванням (`/_serverFn/`): невідомий id дає 500 (Start кидає
// до свого `try`, h3 віддає `unhandled`), і рішення «прийнято, обходу немає» тримається лише на
// тому, що тіло нічого не розкриває. Ту саму пробу на нестандартній базі (`serverFns.base`) несе
// `tests/server-fn-base-build.test.ts`.

const UNKNOWN_ID = 'probe-unknown-fn-7f3a';

/** Що не сміє бути в тілі 500: id з URL, текст апстріму, шляхи ФС і стек. */
const LEAKS = [
  UNKNOWN_ID,
  'Server function info not found',
  'node_modules',
  'file://',
];

/**
 * @param {string} base `http://127.0.0.1:<port>`
 * @param {(label: string, passed: boolean, fact: string) => void} check
 */
export async function checkUnknownServerFn(base, check) {
  for (const method of ['GET', 'POST']) {
    const res = await fetch(`${base}/_serverFn/${UNKNOWN_ID}`, {
      method,
      headers: { origin: base, 'sec-fetch-site': 'same-origin' },
    });
    const body = await res.text();
    const leaked = LEAKS.filter((l) => body.includes(l));
    const stack = /\n\s+at\s/.test(body);
    check(
      `${method} /_serverFn/<невідомий id> (START-SFN-404-1)`,
      res.status === 500 && leaked.length === 0 && !stack,
      `${res.status}, витік: ${leaked.join(', ') || '—'}, стек: ${stack}, тіло: ${JSON.stringify(body.slice(0, 120))}`,
    );
  }
}
