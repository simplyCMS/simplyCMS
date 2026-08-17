import { useEffect, useRef, useState } from 'react';

interface Step {
  kind: 'cmd' | 'out';
  text: string;
  /** Класи підсвітки для out-рядків. */
  tone?: 'ok' | 'dim' | 'hl';
  pause?: number;
}

/** Сценарій: створення магазину → апдейт ядра без жодного зміненого файлу. */
const SCRIPT: Step[] = [
  { kind: 'cmd', text: 'pnpm create simplycms-store my-store' },
  {
    kind: 'out',
    text: '✔ Scaffolded my-store — thin host: 8 files + config',
    tone: 'ok',
  },
  { kind: 'cmd', text: 'cd my-store && pnpm install && pnpm dev', pause: 350 },
  {
    kind: 'out',
    text: '➜ Storefront (SSR) + admin on http://localhost:3000',
    tone: 'hl',
  },
  {
    kind: 'out',
    text: '# …months later: the core shipped new pages',
    tone: 'dim',
    pause: 1300,
  },
  { kind: 'cmd', text: 'pnpm update "@simplycms/*" && pnpm build' },
  { kind: 'out', text: '✔ Core packages updated', tone: 'ok' },
  {
    kind: 'out',
    text: '✔ New canonical pages mounted from node_modules',
    tone: 'ok',
  },
  { kind: 'out', text: '✔ Files changed in your repo: 0', tone: 'ok' },
];

const TYPE_MS = 26;
const OUT_DELAY = 320;
const CMD_DELAY = 700;
const LOOP_HOLD = 9000;

interface Line {
  kind: 'cmd' | 'out';
  text: string;
  tone?: Step['tone'];
}

export function Terminal() {
  const [lines, setLines] = useState<Line[]>([]);
  const [typing, setTyping] = useState('');
  const [done, setDone] = useState(false);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;

    const later = (fn: () => void, ms: number) => {
      timeouts.current.push(window.setTimeout(fn, ms));
    };

    const cleanup = () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
    };

    // setState лише з таймер-колбеків, не з тіла ефекту (react-hooks-правило)
    if (reduced) {
      later(() => {
        setLines(SCRIPT.map(({ kind, text, tone }) => ({ kind, text, tone })));
        setDone(true);
      }, 0);
      return cleanup;
    }

    const run = () => {
      setLines([]);
      setTyping('');
      setDone(false);
      let at = 400;
      for (const step of SCRIPT) {
        at += step.pause ?? 0;
        if (step.kind === 'cmd') {
          at += CMD_DELAY;
          const started = at;
          for (let i = 1; i <= step.text.length; i++) {
            later(
              () => setTyping(step.text.slice(0, i)),
              started + i * TYPE_MS,
            );
          }
          at = started + step.text.length * TYPE_MS + 140;
          later(() => {
            setTyping('');
            setLines((prev) => [...prev, { kind: 'cmd', text: step.text }]);
          }, at);
        } else {
          at += OUT_DELAY;
          later(() => {
            setLines((prev) => [
              ...prev,
              { kind: 'out', text: step.text, tone: step.tone },
            ]);
          }, at);
        }
      }
      later(() => setDone(true), at + 200);
      later(run, at + LOOP_HOLD);
    };

    later(run, 0);
    return cleanup;
  }, []);

  return (
    <div
      className="terminal"
      role="img"
      aria-label="Terminal demo: create a SimplyCMS store, then update the core with zero files changed"
    >
      <div className="terminal-bar" aria-hidden>
        <span className="light" />
        <span className="light" />
        <span className="light" />
        <span className="title">~/my-store — zsh</span>
      </div>
      <div className="terminal-body" aria-hidden>
        {lines.map((line, i) =>
          line.kind === 'cmd' ? (
            <div className="line" key={i}>
              <span className="prompt">❯ </span>
              <span className="cmd-text">{line.text}</span>
            </div>
          ) : (
            <div className="line" key={i}>
              <span
                className={
                  line.tone === 'ok' ? 'ok' : line.tone === 'hl' ? 'hl' : 'out'
                }
              >
                {line.text}
              </span>
            </div>
          ),
        )}
        {!done && (
          <div className="line">
            <span className="prompt">❯ </span>
            <span className="cmd-text">{typing}</span>
            <span className="caret" />
          </div>
        )}
        {done && (
          <div className="line">
            <span className="prompt">❯ </span>
            <span className="caret" />
          </div>
        )}
      </div>
    </div>
  );
}
