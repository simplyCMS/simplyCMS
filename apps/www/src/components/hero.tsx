import { EXT, LINKS } from '../lib/links';
import { NPM_SEARCH_URL } from '../lib/live-stats';
import { ExternalIcon, GitHubIcon, PulseDot } from './icons';
import { CopyCommand, CountUp, Reveal, useStats } from './primitives';
import { Terminal } from './terminal';

export function Hero() {
  const { stats } = useStats();
  const version = stats.npm?.version ?? null;

  return (
    <section className="hero" id="top">
      <div className="hero-bg" aria-hidden>
        <div className="grid-lines" />
        <div className="glow-amber" />
        <div className="glow-green" />
      </div>
      <div className="container">
        <div className="hero-grid">
          <div>
            <Reveal>
              <span className="hero-eyebrow">
                <PulseDot />
                open source · MIT ·{' '}
                {version ? `v${version} on npm` : 'shipping on npm'}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <h1>
                The open-source e-commerce platform for the <em>TypeScript</em>{' '}
                era.
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="hero-lede">
                Storefront, admin, checkout and plugins on{' '}
                <strong>TanStack Start, React&nbsp;19 and Supabase</strong> —
                not on 2008-era PHP. Your store is a thin assembly of ~8 files;
                the core ships as versioned npm packages, so{' '}
                <strong>
                  <span className="mono">pnpm&nbsp;update</span> delivers new
                  pages and fixes
                </strong>{' '}
                to stores already in production.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="hero-ctas">
                <CopyCommand command="pnpm create simplycms-store" />
                <a className="btn btn-ghost" href={LINKS.github} {...EXT}>
                  <GitHubIcon size={17} />
                  View on GitHub
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <p className="hero-note">
                No signup. No license key. <b>MIT</b> — your checkout, your
                data, your infra.
              </p>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <Terminal />
          </Reveal>
        </div>

        <MetricsStrip />
      </div>
      <PackageTicker />
    </section>
  );
}

function MetricsStrip() {
  const { stats, live, settled } = useStats();
  const version = stats.npm?.version ?? null;

  return (
    <Reveal delay={120} className="metrics">
      <div className="metrics-box">
        <a className="metric" href={`${LINKS.github}/stargazers`} {...EXT}>
          <CountUp
            value={settled ? (stats.github?.stars ?? 0) : null}
            placeholder={100}
          />
          <span className="label">
            GitHub stars <ExternalIcon />
          </span>
        </a>
        <a className="metric" href={LINKS.npmOrg} {...EXT}>
          <CountUp
            value={settled ? (stats.npm?.monthlyDownloads ?? null) : null}
            placeholder={15429}
          />
          <span className="label">
            npm downloads / month <ExternalIcon />
          </span>
        </a>
        <a className="metric" href={NPM_SEARCH_URL} {...EXT}>
          <CountUp
            value={settled ? (stats.npm?.packageCount ?? null) : null}
            placeholder={26}
          />
          <span className="label">
            published packages <ExternalIcon />
          </span>
        </a>
        <a className="metric" href={LINKS.releases} {...EXT}>
          <span
            className={`value mono${settled && version ? '' : ' skeleton'}`}
          >
            {settled && version ? `v${version}` : 'v0.0.0'}
          </span>
          <span className="label">
            latest release <ExternalIcon />
          </span>
        </a>
        <div className="metrics-live">
          {live ? (
            <span className="live-badge">
              <PulseDot />
              LIVE
            </span>
          ) : (
            <span className="live-badge" style={{ color: 'var(--ink-faint)' }}>
              SNAPSHOT
            </span>
          )}
          <span className="src">
            {live ? (
              <>
                fetched in your browser from{' '}
                <a href={LINKS.github} {...EXT}>
                  GitHub
                </a>{' '}
                &amp;{' '}
                <a href={LINKS.npmOrg} {...EXT}>
                  npm
                </a>{' '}
                — never stale
              </>
            ) : (
              <>
                build-time values — live numbers load from{' '}
                <a href={LINKS.github} {...EXT}>
                  GitHub
                </a>{' '}
                &amp;{' '}
                <a href={LINKS.npmOrg} {...EXT}>
                  npm
                </a>
              </>
            )}
          </span>
        </div>
      </div>
    </Reveal>
  );
}

/** Фолбек-склад тікера, поки живий список пакетів не приїхав. */
const FALLBACK_TICKER = [
  // 🔴 Це імена ОПУБЛІКОВАНИХ пакетів, не субшляхи. Після К0 їх рівно пʼять:
  // 22 пакети тірів T0–T5 (`objects`/`domain`/`ui`/`admin`/`*-routes`/…)
  // злиті у флагман `simplycms` і доступні лише субшляхами.
  'simplycms',
  '@simplycms/cli',
  '@simplycms/theme-solarstore',
  '@simplycms/plugin-faq',
  'create-simplycms-store',
];

function PackageTicker() {
  const { stats } = useStats();
  const livePackages = stats.npm?.packages ?? [];

  const items =
    livePackages.length > 0
      ? livePackages.map((p) => ({
          name: p.name,
          version: p.version,
          monthly: p.monthly,
        }))
      : FALLBACK_TICKER.map((name) => ({
          name,
          version: stats.npm?.version ?? null,
          monthly: null,
        }));

  // Стрічка рендериться двічі — безшовний CSS-луп на translateX(-50%)
  const renderRow = (suffix: string) =>
    items.map((p) => (
      <span key={`${p.name}${suffix}`}>
        <b>{p.name}</b>
        {p.version ? `@${p.version}` : ''}
        {p.monthly !== null && (
          <>
            {' '}
            <span className="dl">↓{p.monthly.toLocaleString('en-US')}/mo</span>
          </>
        )}
      </span>
    ));

  return (
    <div className="ticker-wrap" aria-hidden>
      <div className="ticker">
        {renderRow('')}
        {renderRow('-dup')}
      </div>
    </div>
  );
}
