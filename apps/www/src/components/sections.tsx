import type { MouseEvent, ReactNode } from 'react';
import { EXT, LINKS } from '../lib/links';
import { Reveal } from './primitives';

/* ---------- §1. Updates that arrive (fork problem) ---------- */

export function UpdatesSection() {
  return (
    <section className="section" id="updates">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">The core promise</p>
          <h2>
            Core updates that <em>actually arrive</em>
          </h2>
          <p className="lede">
            Every open-source cart makes you fork the codebase — and every fork
            starts drifting the day you deploy it. SimplyCMS mounts canonical
            pages straight from{' '}
            <span className="inline-code">node_modules</span> via TanStack
            Router virtual routes, so the framework of your store lives in
            versioned packages, not in your repo.{' '}
            <a href={LINKS.howItWorks} {...EXT}>
              Read how it works →
            </a>
          </p>
        </Reveal>

        <div className="diff-grid">
          <Reveal className="diff-card bad" delay={80}>
            <div className="diff-head">
              <span>upgrade-store.sh</span>
              <span className="tag">the fork way</span>
            </div>
            <div className="diff-body">
              <span className="diff-line minus">- git merge upstream/main</span>
              <span className="diff-line minus">
                - # CONFLICT in 214 template files
              </span>
              <span className="diff-line minus">
                - # re-apply your customisations by hand
              </span>
              <span className="diff-line minus">
                - # …or stay on the old version forever
              </span>
              <span className="diff-line ctx">
                {' '}
                # every store, every release
              </span>
            </div>
            <p className="diff-quote">
              <em>“Do not use git merge…”</em>
              <span className="who">
                — a real storefront upgrade guide from a leading JS commerce
                framework. The next major dropped the update channel entirely.
              </span>
            </p>
          </Reveal>

          <Reveal className="diff-card good" delay={160}>
            <div className="diff-head">
              <span>upgrade-store.sh</span>
              <span className="tag">the SimplyCMS way</span>
            </div>
            <div className="diff-body">
              <span className="diff-line plus">
                + pnpm update simplycms &quot;@simplycms/*&quot;
              </span>
              <span className="diff-line plus">+ pnpm build</span>
              <span className="diff-line ctx">
                {' '}
                # new canonical pages mount from node_modules
              </span>
              <span className="diff-line ctx">
                {' '}
                # host files in your repo: ~8 — `simplycms update`
              </span>
              <span className="diff-line ctx">
                {' '}
                # migrates them on the rare release that needs it
              </span>
            </div>
            <p className="diff-quote">
              <em>Your repo never merges upstream.</em>
              <span className="who">
                — the skeleton-update problem the industry left open, solved as
                the founding requirement of this architecture.
              </span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- §2. How it works ---------- */

export function HowItWorksSection() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">How it works</p>
          <h2>
            A real store in <em>three moves</em>
          </h2>
        </Reveal>

        <div className="steps">
          <Reveal className="step" delay={60}>
            <span className="num">01</span>
            <h3>Scaffold the thin host</h3>
            <p>
              One command creates a working store: SSR storefront, admin panel,
              cart, checkout, default theme. The repo you own stays tiny.
            </p>
            <pre className="step-code">
              <span className="g">❯</span>{' '}
              <span className="w">pnpm create simplycms-store</span>
              {'\n'}
              <span className="c">my-store/</span>
              {'\n'}
              <span className="c">├─</span> simplycms.config.ts{' '}
              <span className="y"># the source of truth</span>
              {'\n'}
              <span className="c">├─</span> routes.ts{' '}
              <span className="c"># mounts core route packages</span>
              {'\n'}
              <span className="c">├─</span> src/routes/my/{' '}
              <span className="c"># your own pages</span>
              {'\n'}
              <span className="c">├─</span> supabase/migrations/
              {'\n'}
              <span className="c">└─</span> themes/ · plugins/
            </pre>
          </Reveal>

          <Reveal className="step" delay={140}>
            <span className="num">02</span>
            <h3>Make it yours</h3>
            <p>
              Install themes and plugins as npm packages with{' '}
              <code>simplycms add</code>; switch and configure them from the
              admin — no rebuild. Add custom pages in{' '}
              <code>src/routes/my/</code>.
            </p>
            <pre className="step-code">
              <span className="g">❯</span>{' '}
              <span className="w">simplycms add acme-theme --theme</span>
              {'\n'}
              <span className="g">❯</span>{' '}
              <span className="w">simplycms add acme-plugin-faq</span>
              {'\n'}
              <span className="g">❯</span>{' '}
              <span className="w">simplycms db:diff --write</span>{' '}
              <span className="c"># reviewed SQL</span>
            </pre>
          </Reveal>

          <Reveal className="step" delay={220}>
            <span className="num">03</span>
            <h3>Stay current, effortlessly</h3>
            <p>
              The core evolves as one synchronized release train. Updating is a
              dependency bump — new pages, fixes and SEO improvements included.
            </p>
            <pre className="step-code">
              <span className="g">❯</span>{' '}
              <span className="w">
                pnpm update simplycms &quot;@simplycms/*&quot;
              </span>
              {'\n'}
              <span className="g">❯</span>{' '}
              <span className="w">pnpm simplycms doctor</span>{' '}
              <span className="c"># config ↔ DB ↔ build sanity</span>
              {'\n'}
              <span className="g">❯</span>{' '}
              <span className="w">pnpm simplycms update</span>{' '}
              <span className="c"># migrates the ~8 host files</span>
            </pre>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- §3. Features ---------- */

interface Feature {
  icon: ReactNode;
  title: string;
  body: ReactNode;
}

function FeatureIcon({ d }: { d: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

const FEATURES: Feature[] = [
  {
    icon: <FeatureIcon d="M3 12h4l2-7 4 14 2-7h6M3 5h2M3 19h2" />,
    title: 'SEO-first SSR storefront',
    body: (
      <>
        Canonical pages — catalog, product, cart, checkout — stream full HTML
        for crawlers and AI agents. <code>sitemap.xml</code> and{' '}
        <code>robots.txt</code> are generated by the server entry, not an
        afterthought plugin.
      </>
    ),
  },
  {
    icon: <FeatureIcon d="M4 5h16v4H4zM4 13h7v6H4zM15 13h5v6h-5" />,
    title: 'Admin panel included',
    body: (
      <>
        Products, orders, reviews, users, discounts, themes and plugins under{' '}
        <code>/admin</code> — a client-side SPA guarded by server middleware.
        Owners activate and configure; nothing rebuilds.
      </>
    ),
  },
  {
    icon: (
      <FeatureIcon d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-7.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
    ),
    title: 'Plugin SDK with a trust boundary',
    body: (
      <>
        Plugins use ports from <code>simplycms/plugin-sdk</code> — never a raw
        database client. Own tables live under a <code>plg_*</code> namespace;
        migrations ship inside the package and land as reviewed SQL.
      </>
    ),
  },
  {
    icon: (
      <FeatureIcon d="M12 3 4 7v5c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7l-8-4ZM8.5 12l2.3 2.3 4.7-4.6" />
    ),
    title: 'Typed database pipeline',
    body: (
      <>
        The schema — 40 tables and 93 row-level-security policies — is Drizzle
        TypeScript. <code>simplycms db:diff</code> emits SQL migrations for
        human review; generated types keep every query compile-checked.
      </>
    ),
  },
  {
    icon: (
      <FeatureIcon d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6ZM14 3v6h6M9 13h6M9 17h4" />
    ),
    title: 'Themes without lock-in',
    body: (
      <>
        A theme is tokens + brand components — it never owns pages, so core
        updates can’t break it. Install from npm for upstream fixes, or{' '}
        <code>--copy</code> it into your repo and own every line.
      </>
    ),
  },
  {
    icon: (
      <FeatureIcon d="M4 6c0-1.5 3.6-3 8-3s8 1.5 8 3-3.6 3-8 3-8-1.5-8-3Zm0 0v12c0 1.5 3.6 3 8 3s8-1.5 8-3V6M4 12c0 1.5 3.6 3 8 3s8-1.5 8-3" />
    ),
    title: 'i18n from day one',
    body: (
      <>
        1,100+ message keys in mirrored <code>uk</code>/<code>en</code>{' '}
        catalogs, typed against a closed union. Themes and plugins carry their
        own catalogs — coverage is proven by AST-scanning tests, not promises.
      </>
    ),
  },
];

export function FeaturesSection() {
  const trackGlow = (e: MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  return (
    <section className="section" id="features">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">Batteries included</p>
          <h2>
            A full store, <em>engineered</em> — not assembled from 40 plugins
          </h2>
          <p className="lede">
            Everything a production shop needs ships in the core packages and is
            tested as one system — including a packaging pilot that builds a
            real store from published tarballs before every release.
          </p>
        </Reveal>

        <div className="features">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 80}>
              <div className="feature" onMouseMove={trackGlow}>
                <span className="icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
