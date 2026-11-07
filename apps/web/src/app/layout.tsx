import { PrivacyAnalytics } from '@/components/layout/privacy-analytics';
import type { Metadata } from 'next';
import {
  Atkinson_Hyperlegible,
  Barlow_Condensed,
  IBM_Plex_Sans,
  Inter,
  Literata,
  Manrope,
} from 'next/font/google';
import Script from 'next/script';
import { ConditionalAppHeader } from '@/components/layout/conditional-header';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const literata = Literata({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-literata',
  display: 'swap',
});

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-manrope',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const atkinsonHyperlegible = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FresiCMT',
  referrer: 'no-referrer',
  description:
    'Academic conference management — submissions, peer review, decisions, and registration in one platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${literata.variable} ${manrope.variable} ${ibmPlexSans.variable} ${atkinsonHyperlegible.variable} ${barlowCondensed.variable}`}
    >
      <body className={inter.className}>
        <Script
          id="analytics-privacy"
          strategy="beforeInteractive"
        >{`window.conferenceAnalyticsBeforeSend = function(type, payload) {
          var excluded = /\\/(?:auth|sign-in|sign-up|join|reviewer-invite|reviewer-invitations)(?:\\/|$)/;
          if (excluded.test(window.location.pathname)) return false;
          if (payload && payload.url && excluded.test(new URL(payload.url, window.location.origin).pathname)) return false;
          if (payload && payload.referrer) { try { var ref = new URL(payload.referrer, window.location.origin); payload.referrer = excluded.test(ref.pathname) ? '' : ref.origin + ref.pathname; } catch (_) { payload.referrer = ''; } }
          return payload;
        };`}</Script>
        <PrivacyAnalytics />
        <ConditionalAppHeader />
        {children}
      </body>
    </html>
  );
}
