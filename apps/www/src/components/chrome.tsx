import { useEffect, useState } from 'react';
import { formatGrouped } from '../lib/live-stats';
import { EXT, LINKS } from '../lib/links';
import { GitHubIcon, LogoMark, NpmIcon, PulseDot, StarIcon } from './icons';
import { useStats } from './primitives';

const NAV_ITEMS = [
  ['#updates', 'Updates'],
  ['#how', 'How it works'],
  ['#features', 'Features'],
  ['#stack', 'Stack'],
  ['#compare', 'Compare'],
  ['#ecosystem', 'Ecosystem'],
  ['#roadmap', 'Roadmap'],
] as const;

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const { stats } = useStats();
  const stars = stats.github?.stars ?? null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`nav${scrolled ? ' scrolled' : ''}`}>
      <div className="container nav-inner">
        <a href="#top" className="nav-logo" aria-label="SimplyCMS — home">
          <LogoMark />
          <span>SimplyCMS</span>
        </a>
        <nav className="nav-links" aria-label="Sections">
          {NAV_ITEMS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a
            className="nav-icon-link"
            href={LINKS.npmOrg}
            aria-label="SimplyCMS packages on npm"
            {...EXT}
          >
            <NpmIcon size={20} />
          </a>
          <a className="gh-chip" href={LINKS.github} {...EXT}>
            <GitHubIcon size={16} />
            <span>Star</span>
            <span className="star" aria-hidden>
              <StarIcon size={12} />
            </span>
            {stars !== null && stars > 0 && (
              <span className="count">{formatGrouped(stars)}</span>
            )}
          </a>
        </div>
      </div>
    </header>
  );
}

const FOOTER_PROJECT = [
  [LINKS.github, 'GitHub repository'],
  [LINKS.npmOrg, 'npm — @simplycms'],
  [LINKS.changelog, 'Changelog'],
  [LINKS.releases, 'Releases'],
  [LINKS.issues, 'Issues'],
  [LINKS.license, 'MIT license'],
] as const;

const FOOTER_DOCS = [
  [LINKS.howItWorks, 'How the platform works'],
  [LINKS.archSpec, 'Architecture specification'],
  [LINKS.roadmap, 'Roadmap'],
  [LINKS.themesGuide, 'Theme guide'],
  [LINKS.pluginsDoc, 'Plugin mechanism'],
  [LINKS.cliDoc, 'CLI reference'],
  [LINKS.marketplaceDoc, 'Marketplace contract'],
] as const;

const FOOTER_PACKAGES = [
  [LINKS.npmScaffolder, 'create-simplycms-store'],
  [LINKS.npmCli, '@simplycms/cli'],
  [LINKS.npmPluginSdk, '@simplycms/plugin-sdk'],
  [LINKS.npmTheme, '@simplycms/theme-solarstore'],
] as const;

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="#top" className="nav-logo" aria-label="SimplyCMS — top">
              <LogoMark />
              <span>SimplyCMS</span>
            </a>
            <p>
              The open-source e-commerce platform for the TypeScript era. Thin
              store, versioned core, updates that actually arrive.
            </p>
          </div>
          <div>
            <h5>Project</h5>
            <ul>
              {FOOTER_PROJECT.map(([href, label]) => (
                <li key={href}>
                  <a href={href} {...EXT}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Documentation</h5>
            <ul>
              {FOOTER_DOCS.map(([href, label]) => (
                <li key={href}>
                  <a href={href} {...EXT}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h5>Packages</h5>
            <ul>
              {FOOTER_PACKAGES.map(([href, label]) => (
                <li key={href}>
                  <a href={href} {...EXT} className="mono">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SimplyCMS · MIT</span>
          <span>Made in Ukraine</span>
          <span className="spacer" />
          <span className="live-note">
            <PulseDot />
            numbers on this page are read live from GitHub &amp; npm
          </span>
        </div>
      </div>
    </footer>
  );
}
