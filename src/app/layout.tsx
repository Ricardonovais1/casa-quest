import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: {
    default: 'Casa Quest',
    template: '%s | Casa Quest',
  },
  description:
    'Responsabilidade não se compra, se cultiva. A Casa Quest organiza as tarefas da família em missões, dá a cada filho um link próprio e transforma constância em energia de compromisso.',
  applicationName: 'Casa Quest',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Casa Quest',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Casa Quest',
    description: 'Responsabilidade não se compra, se cultiva.',
    locale: 'pt_BR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={cn(geistSans.variable, 'h-full antialiased')}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions inject attributes on <body> */}
      <body className="flex min-h-full flex-col bg-gray-50 text-gray-900" suppressHydrationWarning>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
