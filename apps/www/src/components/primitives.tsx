import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { formatGrouped, skeletonFor } from '../lib/live-stats';
import { useLiveStats, type LiveStatsState } from '../lib/use-live-stats';
import { CheckIcon, CopyIcon } from './icons';

/* ---------- Live-stats context: один фетч на сторінку ---------- */

const LiveStatsContext = createContext<LiveStatsState | null>(null);

export function LiveStatsProvider({ children }: { children: ReactNode }) {
  const state = useLiveStats();
  return (
    <LiveStatsContext.Provider value={state}>
      {children}
    </LiveStatsContext.Provider>
  );
}

export function useStats(): LiveStatsState {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) throw new Error('useStats поза LiveStatsProvider');
  return ctx;
}

/* ---------- CountUp: число, що «прилітає» після фетчу ---------- */

function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

interface CountUpProps {
  /** null — значення ще не приїхало: рендеримо мигаючий скелетон. */
  value: number | null;
  /** Ширина скелетона (число-зразок), поки value === null. */
  placeholder?: number;
  duration?: number;
}

export function CountUp({
  value,
  placeholder = 10000,
  duration = 1100,
}: CountUpProps) {
  const [shown, setShown] = useState<number | null>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (value === null) return;
    // Анімуємо лише перше прибуття; далі (і при reduced-motion) — один кадр.
    // setState завжди з rAF-колбека, не з тіла ефекту (react-hooks-правило).
    const reduced =
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = animated.current || reduced ? 0 : duration;
    animated.current = true;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = dur === 0 ? 1 : Math.min((now - started) / dur, 1);
      setShown(Math.round(value * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (value === null || shown === null) {
    return (
      <span className="value skeleton mono" aria-hidden>
        {skeletonFor(placeholder)}
      </span>
    );
  }
  return <span className="value mono">{formatGrouped(shown)}</span>;
}

/* ---------- Команда з копіюванням ---------- */

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      type="button"
      className={`cmd${copied ? ' copied' : ''}`}
      onClick={copy}
      aria-label={`Copy command: ${command}`}
    >
      <span className="dollar">$</span>
      <span>{command}</span>
      <span className="copy-btn" aria-hidden>
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      </span>
    </button>
  );
}

/* ---------- Reveal-обгортка ---------- */

interface RevealProps {
  children: ReactNode;
  delay?: number;
  as?: 'div' | 'section';
  className?: string;
  id?: string;
}

export function Reveal({
  children,
  delay = 0,
  as = 'div',
  className = '',
  id,
}: RevealProps) {
  const Tag = as;
  return (
    <Tag
      id={id}
      className={`reveal ${className}`.trim()}
      style={delay ? { ['--reveal-delay' as string]: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

/** Вішає IntersectionObserver на все з класом .reveal (раз на маунт). */
export function useRevealObserver() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in-view'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
