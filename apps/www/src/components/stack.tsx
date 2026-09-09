import type { ReactNode } from 'react';
import { EXT } from '../lib/links';
import {
  DrizzleLogo,
  ExternalIcon,
  PnpmLogo,
  ReactLogo,
  ShadcnLogo,
  SupabaseLogo,
  TailwindLogo,
  TanStackLogo,
  TypeScriptLogo,
  ViteLogo,
  ZodLogo,
} from './icons';
import { Reveal, useStats } from './primitives';

interface StackItem {
  name: string;
  host: string;
  href: string;
  logo: ReactNode;
}

const STACK: StackItem[] = [
  {
    name: 'TanStack Start',
    host: 'tanstack.com',
    href: 'https://tanstack.com/start',
    logo: <TanStackLogo />,
  },
  {
    name: 'React 19',
    host: 'react.dev',
    href: 'https://react.dev',
    logo: <ReactLogo />,
  },
  {
    name: 'TypeScript',
    host: 'typescriptlang.org',
    href: 'https://www.typescriptlang.org',
    logo: <TypeScriptLogo />,
  },
  {
    name: 'Vite',
    host: 'vite.dev',
    href: 'https://vite.dev',
    logo: <ViteLogo />,
  },
  {
    name: 'Supabase',
    host: 'supabase.com',
    href: 'https://supabase.com',
    logo: <SupabaseLogo />,
  },
  {
    name: 'Tailwind CSS v4',
    host: 'tailwindcss.com',
    href: 'https://tailwindcss.com',
    logo: <TailwindLogo />,
  },
  {
    name: 'shadcn/ui',
    host: 'ui.shadcn.com',
    href: 'https://ui.shadcn.com',
    logo: <ShadcnLogo />,
  },
  {
    name: 'Drizzle ORM',
    host: 'orm.drizzle.team',
    href: 'https://orm.drizzle.team',
    logo: <DrizzleLogo />,
  },
  {
    name: 'Zod',
    host: 'zod.dev',
    href: 'https://zod.dev',
    logo: <ZodLogo />,
  },
  {
    name: 'pnpm',
    host: 'pnpm.io',
    href: 'https://pnpm.io',
    logo: <PnpmLogo />,
  },
];

export function StackSection() {
  const { stats, live } = useStats();
  const ts = live ? stats.tsShare : null;

  return (
    <section className="section" id="stack">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">The stack</p>
          <h2>
            Built on the stack you’d <em>choose anyway</em>
          </h2>
          <p className="lede">
            No legacy PHP, no jQuery admin, no template engine from 2008. One
            language across storefront, server functions, database schema and
            plugins — strict TypeScript, end to end.
          </p>
          {ts !== null && (
            <span className="stack-note">
              <b>{ts}%</b> of the repository is TypeScript — measured live from
              GitHub
            </span>
          )}
        </Reveal>

        <div className="stack-grid">
          {STACK.map((item, i) => (
            <Reveal key={item.name} delay={(i % 5) * 60}>
              <a className="stack-tile" href={item.href} {...EXT}>
                {item.logo}
                <span className="name">{item.name}</span>
                <span className="host">
                  {item.host} <ExternalIcon />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
