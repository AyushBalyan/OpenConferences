import type { Metadata } from 'next';
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document';

export const metadata: Metadata = {
  title: 'Privacy policy · FresiCMT',
  description:
    'How FresiCMT collects, uses, and shares personal information for conference submission, peer review, and registration.',
};

const updated = '25 October 2026';

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    body: (
      <>
        <p>
          This policy explains how FresiCMT (“we”, “us”) handles personal information when you use
          the FresiCMT website and application at app.fresi.org (the “Platform”). FresiCMT is a
          conference management system for manuscript submission, peer review, decisions,
          camera-ready collection, and registration.
        </p>
        <p>
          “You” means a visitor, an account holder, or a person whose information is entered into a
          conference on the Platform, including an author, reviewer, chair, or organizer.
        </p>
        <p>
          Questions about this policy can be sent to{' '}
          <a href="mailto:contact@fresi.org">contact@fresi.org</a>.
        </p>
      </>
    ),
  },
  {
    id: 'summary',
    title: 'Summary',
    body: (
      <>
        <ul>
          <li>
            Your FresiCMT account belongs to you. It is not tied to a single conference, and you can
            use the same account for more than one conference.
          </li>
          <li>
            When you take part in a conference, we process the information needed for that
            conference so its organizers can run submission, review, decision, and registration
            workflows.
          </li>
          <li>
            Organizers of a conference decide how that conference uses participant information. They
            can see information for their own conference. They do not receive your activity from
            other conferences.
          </li>
          <li>
            We do not sell personal information, and we do not use it to build advertising profiles.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'roles',
    title: 'FresiCMT and conference organizers',
    body: (
      <>
        <p>
          We control account information that exists so you can sign in and use the Platform: your
          name, email address, password, verification status, and security settings.
        </p>
        <p>
          A conference organizer controls the information collected for that conference, such as
          submissions, authorship, reviews, conflicts of interest, decisions, and registrations. We
          process that information to provide the Platform, following the organizer’s configuration
          and the roles they assign. If you want to exercise a privacy right about a paper, review,
          or registration, contact the conference organizer as well as us. We can help route the
          request, but the organizer decides what their conference record must keep.
        </p>
      </>
    ),
  },
  {
    id: 'information',
    title: 'Information we collect',
    body: (
      <>
        <h3>Account</h3>
        <p>When you create an account we collect:</p>
        <ul>
          <li>Your name and email address.</li>
          <li>A password, stored only as a hash. We do not keep the password itself.</li>
          <li>
            Whether your email address has been verified, and the one-time code used to verify it.
          </li>
          <li>
            Optional multi-factor authentication details if you turn that on, including a time-based
            one-time password secret.
          </li>
        </ul>
        <p>
          If you join a conference as an author, you may also give an affiliation or institution.
          Reviewer invitations are sent to the email address the organizer enters. Accepting an
          invitation adds a reviewer role to the matching account. It does not create a second
          account.
        </p>
        <h3>Conference work</h3>
        <p>Depending on your role and the conference setup, the Platform stores:</p>
        <ul>
          <li>
            Submissions: title, abstract, keywords, authorship, corresponding-author details, and
            uploaded files such as manuscripts and camera-ready versions.
          </li>
          <li>
            Review records: assignments, bids, conflict-of-interest declarations, scores,
            recommendations, comments to authors, and comments meant only for chairs.
          </li>
          <li>Decisions, rebuttals, and the messages the conference sends about that work.</li>
          <li>
            Registration details, including the fee the organizer set, payment status, and any
            student-verification document an organizer asks you to upload.
          </li>
        </ul>
        <p>
          What another participant can see depends on their role and the conference’s blinding mode.
          Open, single-blind, and double-blind settings change which identity fields are shown.
          Comments to chairs and unreleased reviews are not shown to authors.
        </p>
        <h3>Payments</h3>
        <p>
          Registration payments are processed by Razorpay. Razorpay collects the payment details
          needed to complete the transaction. We receive the result: amount, currency, status, and
          the provider’s payment reference. We do not store full card numbers.
        </p>
        <h3>Messages</h3>
        <p>
          We send email that the workflow needs, such as verification codes, password resets,
          reviewer invitations, submission receipts, assignment notices, and other conference
          messages an organizer triggers. We keep a log of those messages, including the recipient,
          template, delivery status, and provider message id. If a message bounces, we may suppress
          further mail to that address.
        </p>
        <h3>Security and usage</h3>
        <p>To keep accounts and the service working, we record:</p>
        <ul>
          <li>Session information, including a sign-in cookie, expiry, IP address, and browser.</li>
          <li>Audit records of sensitive actions, such as role changes and invitation events.</li>
          <li>
            The result of Cloudflare Turnstile checks on sign-in and sign-up, when that check is
            enabled.
          </li>
          <li>
            Aggregate visit measurements through Umami, such as the page, referrer, browser, and
            country. We do not use this for advertising.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How we use information',
    body: (
      <>
        <p>We use personal information to:</p>
        <ul>
          <li>Create and protect your account, including email verification and sign-in.</li>
          <li>
            Run the conference you join: submissions, invitations, assignments, reviews, decisions,
            camera-ready files, and registration.
          </li>
          <li>Send the operational email described above.</li>
          <li>Detect abuse, lock out repeated failed sign-ins, and investigate security events.</li>
          <li>Keep the audit trail organizers and we need to reconstruct a workflow action.</li>
          <li>
            Measure aggregate use of the public pages so we can see whether they load and are used.
          </li>
        </ul>
        <p>
          We do not use your conference content to train public models, and we do not sell it.
          Organizers may export or act on their own conference records through the Platform,
          including an integration they authorize.
        </p>
      </>
    ),
  },
  {
    id: 'access',
    title: 'Who can see it',
    body: (
      <>
        <p>
          <strong>You</strong> can see your account and the conference work your role allows.
        </p>
        <p>
          <strong>Conference organizers and chairs</strong> can see the records of their conference,
          within the permissions of their role. A reviewer invitation, assignment, or decision stays
          inside that conference. Organizers do not get a combined view of the other conferences on
          your account.
        </p>
        <p>
          <strong>Reviewers</strong> see the papers assigned to them, to the extent the blinding
          mode allows, and the review forms they are asked to complete. They do not see other
          reviewers’ confidential comments unless the conference is configured to show them.
        </p>
        <p>
          <strong>Authors</strong> see their own submissions and the reviews an organizer has
          released to authors.
        </p>
        <p>
          <strong>People who operate FresiCMT</strong> can access information when they need it to
          run, secure, or support the Platform.
        </p>
        <p>
          <strong>Authorized integrations.</strong> An organizer may issue a conference API key.
          That key can read the conference data its scopes allow, such as papers, authors, or
          reviewer contacts. The organizer controls the key. We do not give that integration access
          to other conferences.
        </p>
        <p>
          We may also disclose information if the law requires it, if we need to protect the rights,
          safety, or security of users or the Platform, or if the service is transferred to a
          successor who agrees to handle it under this policy.
        </p>
      </>
    ),
  },
  {
    id: 'providers',
    title: 'Service providers',
    body: (
      <>
        <p>
          We use other companies to host and deliver the Platform. They process personal information
          only so we can provide the service:
        </p>
        <ul>
          <li>Supabase, for the PostgreSQL database, hosted in the Mumbai region.</li>
          <li>Amazon Web Services, for the application and background worker.</li>
          <li>Vercel, for the website.</li>
          <li>Cloudflare, for network protection, Turnstile, and private file storage.</li>
          <li>Zoho Zepto Mail, for transactional email.</li>
          <li>Resend, where a conference uses it for organizer outreach.</li>
          <li>Razorpay, for registration payments.</li>
          <li>Umami, for aggregate page measurements.</li>
        </ul>
        <p>
          The primary database is in India. Some of these providers process information in other
          countries. Their own terms describe that processing.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <>
        <p>
          We keep account information while your account is active. Verification codes and
          password-reset links expire on a short timer. Session records end when you sign out or the
          session expires.
        </p>
        <p>
          Conference records, including submissions, reviews, decisions, files, and payment status,
          are kept for the life of that conference record so organizers can run and later refer to
          the scholarly process. Audit logs are kept as part of that record.
        </p>
        <p>
          If you ask us to delete your account, we will delete or detach the account credentials. A
          conference organizer may still need the submission, authorship, review, or payment record
          that was created while you participated. Where we can, we will limit that remaining record
          to what the conference workflow requires.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    body: (
      <>
        <p>
          Passwords are hashed. Sign-in cookies are HTTP-only. Manuscript files are stored in a
          private bucket and opened through short-lived links. Access to a conference is checked
          against your role on that conference. Payment card details stay with Razorpay.
        </p>
        <p>
          No method of transmission or storage is perfectly secure. You are responsible for the
          password and devices you use to sign in. Tell us at{' '}
          <a href="mailto:contact@fresi.org">contact@fresi.org</a> if you believe your account has
          been compromised.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: (
      <>
        <p>The Platform uses a small set of cookies and similar storage:</p>
        <ul>
          <li>A session cookie that keeps you signed in.</li>
          <li>A short-lived security cookie related to sign-in preferences.</li>
          <li>
            Cloudflare Turnstile, when enabled, to check that a sign-in or sign-up is from a person.
          </li>
        </ul>
        <p>
          These are required to operate the account. Blocking them will stop sign-in from working.
          We do not set advertising cookies. Umami is configured as a visit measurement tool and is
          not used to follow you across other sites for ads.
        </p>
      </>
    ),
  },
  {
    id: 'requests',
    title: 'Your requests',
    body: (
      <>
        <p>
          You may ask us for a copy of the account information we hold, ask us to correct it, or ask
          us to delete the account. Write to{' '}
          <a href="mailto:contact@fresi.org">contact@fresi.org</a> from the email address on the
          account. We may ask you to confirm that you control that address before we act. We aim to
          reply within 30 days.
        </p>
        <p>
          You can update your name and password while signed in. Email verification and multi-factor
          authentication are managed from the account screens.
        </p>
        <p>
          If your request is about a submission, review, or registration, we will also need the
          conference organizer, because that record belongs to the conference workflow. Additional
          rights may apply depending on where you live, including under India’s Digital Personal
          Data Protection Act, 2023. This policy does not limit a right that the law does not allow
          us to limit.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    body: (
      <p>
        The Platform is for academic conference work and is not directed at children under 18. Do
        not create an account if you are under 18.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        We may update this policy as the Platform changes. The new version will be posted on this
        page with a new date. If we have your email address and the change materially affects how we
        use account information, we will email you before the change applies.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Privacy questions and requests: <a href="mailto:contact@fresi.org">contact@fresi.org</a>.
        See also the <a href="/terms">Terms of use</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy policy"
      updated={updated}
      lede="This policy describes the personal information FresiCMT handles so organizers, authors, and reviewers can run a conference in one place."
      sections={sections}
    />
  );
}
