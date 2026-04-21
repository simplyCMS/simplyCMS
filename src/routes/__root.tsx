import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@simplycms/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { CMSProvider } from '@simplycms/core/providers/CMSProvider';
import appCss from '../app/globals.css?url';

// Side-effect: реєстрація тем в ThemeRegistry (ізоморфно)
import '../theme-registry';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'SimplyCMS Store' },
      {
        name: 'description',
        content: 'SimplyCMS — open-source e-commerce CMS platform',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <CMSProvider>
            <Outlet />
            <Toaster />
            <SonnerToaster richColors position="top-right" />
          </CMSProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
