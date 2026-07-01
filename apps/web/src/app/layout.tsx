import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ConditionalAppHeader } from '@/components/layout/conditional-header';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OpenConferences',
  description: 'Multi-conference management platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConditionalAppHeader />
        {children}
      </body>
    </html>
  );
}
