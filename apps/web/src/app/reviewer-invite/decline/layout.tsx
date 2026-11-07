import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Reviewer invitation',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default function DeclineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
