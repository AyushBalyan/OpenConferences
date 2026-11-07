'use client';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
const sensitive = /\/(?:auth|sign-in|sign-up|join|reviewer-invite|reviewer-invitations)(?:\/|$)/;
export function PrivacyAnalytics() {
  const pathname = usePathname();
  if (sensitive.test(pathname)) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id="1923e42b-ae25-40f8-bf3a-dabe4cf20e4b"
      data-exclude-search="true"
      data-exclude-hash="true"
      data-before-send="conferenceAnalyticsBeforeSend"
      strategy="afterInteractive"
    />
  );
}
