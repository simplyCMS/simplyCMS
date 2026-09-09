import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import appCss from '../styles.css?url';

const SITE = 'https://simplycms.dev';
const TITLE =
  'SimplyCMS — the open-source e-commerce platform for the TypeScript era';
const DESCRIPTION =
  'Open-source e-commerce on TanStack Start, React 19 and Supabase. Your store is a thin assembly of ~8 files; the core ships as versioned npm packages, so pnpm update delivers new pages to production stores. MIT licensed.';

/** JSON-LD для пошуковиків: софт-продукт із безкоштовним прайсом. */
const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SimplyCMS',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Node.js',
  url: SITE,
  description: DESCRIPTION,
  license: 'https://opensource.org/license/mit',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  sameAs: [
    'https://github.com/simplyCMS/simplyCMS',
    'https://www.npmjs.com/org/simplycms',
  ],
});

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'theme-color', content: '#0b0c10' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      {
        property: 'og:image',
        // Динамічна соціальна картка GitHub — жодного статичного PNG у репо
        content: 'https://opengraph.githubassets.com/1/simplyCMS/simplyCMS',
      },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'canonical', href: SITE },
      ...[
        '/fonts/bricolage-grotesque-var.woff2',
        '/fonts/instrument-serif-italic.woff2',
        '/fonts/jetbrains-mono-var.woff2',
      ].map((href) => ({
        rel: 'preload',
        href,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous' as const,
      })),
    ],
    scripts: [{ type: 'application/ld+json', children: JSON_LD }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <html lang="en" className="no-js">
      <head>
        {/* Знімаємо no-js ДО першого рендеру: reveal-анімації вмикаються
            лише коли JS точно є — інакше статичний HTML лишається видимим */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.remove('no-js')",
          }}
        />
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <div className="grain" aria-hidden />
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main
      style={{
        minHeight: '70vh',
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        padding: '120px 24px',
      }}
    >
      <div>
        <p className="section-eyebrow">404</p>
        <h1 style={{ letterSpacing: '-0.02em' }}>This aisle is empty.</h1>
        <p style={{ color: 'var(--ink-dim)' }}>
          <a href="/" style={{ color: 'var(--accent)' }}>
            ← Back to the storefront
          </a>
        </p>
      </div>
    </main>
  );
}
