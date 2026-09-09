import { EXT, LINKS } from '../lib/links';
import { ArrowRightIcon, CheckIcon, GitHubIcon } from './icons';
import { CopyCommand, Reveal } from './primitives';

/* ---------- Ecosystem ---------- */

const ECO_CARDS = [
  {
    title: 'Write a plugin',
    body: 'Scaffold on the Plugin SDK: admin pages under /admin/<slug>, storefront slots, Zod-validated settings, your own plg_* tables with migrations and an i18n catalog — all inside one npm package.',
    cmd: 'pnpm simplycms create plugin my-plugin',
    href: LINKS.pluginsDoc,
    link: 'Plugin mechanism docs',
  },
  {
    title: 'Design a theme',
    body: 'A theme is design tokens plus brand components — Header, Footer, hero sections. It never owns pages, so a core update can’t break it. Ship it as npm or let stores copy it in and own it.',
    cmd: 'pnpm simplycms create theme aurora',
    href: LINKS.themesGuide,
    link: 'Theme author guide',
  },
  {
    title: 'Publish under your scope',
    body: 'Name it simplycms-plugin-* or simplycms-theme-*, publish to npm under your own scope, then open a PR to the marketplace index — a JSON catalog that points at packages, never stores code.',
    cmd: 'npm publish --access public',
    href: LINKS.marketplaceDoc,
    link: 'Marketplace contract',
  },
] as const;

export function EcosystemSection() {
  return (
    <section className="section" id="ecosystem">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">Ecosystem</p>
          <h2>
            Extensions with a <em>contract</em>, not a wild west
          </h2>
          <p className="lede">
            Everything installable is an npm package with declared core
            compatibility. Plugins live behind a ports-only SDK boundary —
            enforced by lint rules and tests, not by trust.
          </p>
        </Reveal>

        <div className="eco-grid">
          {ECO_CARDS.map((card, i) => (
            <Reveal key={card.title} delay={i * 90}>
              <div className="eco-card">
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <div className="eco-cmd">
                  <span className="g">❯</span> {card.cmd}
                </div>
                <a className="doc-link" href={card.href} {...EXT}>
                  {card.link} <ArrowRightIcon size={13} />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Roadmap ---------- */

const PHASES = [
  {
    title: 'Foundation',
    desc: 'Routes and pages moved into core packages; theme contract v2',
    when: 'shipped · Jul 2026',
    done: true,
  },
  {
    title: 'Packaging pilot',
    desc: 'Store built from real tarballs; production server preset',
    when: 'shipped · Aug 2026',
    done: true,
  },
  {
    title: 'Scaffolder + CLI',
    desc: 'create-simplycms-store, owner bootstrap, simplycms CLI',
    when: 'shipped · Aug 2026',
    done: true,
  },
  {
    title: 'Plugin SDK',
    desc: 'definePlugin, ports, trust boundary, reference FAQ plugin',
    when: 'shipped · Aug 2026',
    done: true,
  },
  {
    title: 'Themes as packages',
    desc: 'npm or copy-in install, admin sync, marketplace contract',
    when: 'shipped · Aug 2026',
    done: true,
  },
  {
    title: 'v1.0 release train',
    desc: 'Strict semver, engines checks, marketplace submissions open',
    when: 'next',
    done: false,
  },
] as const;

export function RoadmapSection() {
  return (
    <section className="section" id="roadmap">
      <div className="container">
        <Reveal className="section-head">
          <p className="section-eyebrow">Roadmap</p>
          <h2>
            Five phases shipped. <em>One to go.</em>
          </h2>
          <p className="lede">
            The platform is built in public — every phase has a written spec, an
            execution plan and a verifiable definition of done.{' '}
            <a href={LINKS.roadmap} {...EXT}>
              Follow the roadmap on GitHub →
            </a>
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="roadmap">
            {PHASES.map((phase) => (
              <div
                key={phase.title}
                className={`phase${phase.done ? '' : ' next'}`}
              >
                <span className="node">
                  {phase.done ? <CheckIcon size={14} /> : '→'}
                </span>
                <h4>{phase.title}</h4>
                <p>{phase.desc}</p>
                <span className="when mono">{phase.when}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- Final CTA ---------- */

export function FinalCta() {
  return (
    <section className="final" id="get-started">
      <div className="container">
        <Reveal>
          <h2>
            Your next store is <em>one command</em> away.
          </h2>
        </Reveal>
        <Reveal delay={90}>
          <p className="lede">
            Scaffold it, run it, own it. If it saves you a fork — leave a star
            so other builders find it.
          </p>
        </Reveal>
        <Reveal delay={170}>
          <div className="final-ctas">
            <CopyCommand command="pnpm create simplycms-store my-store" />
            <a className="btn btn-primary" href={LINKS.github} {...EXT}>
              <GitHubIcon size={17} />
              Star on GitHub
            </a>
            <a className="btn btn-ghost" href={LINKS.docs} {...EXT}>
              Read the docs
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
