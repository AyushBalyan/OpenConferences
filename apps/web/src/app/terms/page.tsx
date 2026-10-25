import type { Metadata } from 'next';
import { LegalDocument, type LegalSection } from '@/components/marketing/legal-document';

export const metadata: Metadata = {
  title: 'Terms of use · FresiCMT',
  description:
    'The terms that apply when you use FresiCMT for conference submission, peer review, decisions, and registration.',
};

const updated = '25 October 2026';

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: (
      <>
        <p>
          These terms are a contract between you and FresiCMT for use of the website and application
          at app.fresi.org (the “Platform”). By creating an account, signing in, or continuing to
          use the Platform, you agree to these terms and to the{' '}
          <a href="/privacy">Privacy policy</a>.
        </p>
        <p>If you do not agree, do not use the Platform.</p>
        <p>
          These terms cover every role on the Platform: organizers, chairs, authors, reviewers, and
          other participants. A conference may also publish its own call for papers, submission
          rules, or registration terms. Those rules govern your relationship with that conference.
          They do not replace these terms for use of the Platform.
        </p>
      </>
    ),
  },
  {
    id: 'platform',
    title: 'The Platform',
    body: (
      <>
        <p>
          FresiCMT lets an organizer run one conference workflow: calls and submissions, reviewer
          invitations, assignments, conflict checks, reviews, decisions, camera-ready files, and
          registration. Your account is global. A role such as author or reviewer is granted on a
          specific conference and does not by itself grant that role on any other conference.
        </p>
        <p>
          We may change, suspend, or withdraw a feature. We do not promise that every screen will be
          available without interruption.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Accounts',
    body: (
      <>
        <p>
          You must give your real name and an email address you control, and you must verify that
          address before signing in. Keep your password confidential. Tell us at{' '}
          <a href="mailto:contact@fresi.org">contact@fresi.org</a> if you believe someone else is
          using your account. You are responsible for activity under your account until you tell us
          it is compromised.
        </p>
        <p>
          One person, one account. Do not create a second account to avoid a conflict check, a
          declined invitation, or a restriction. Do not share your password or a multi-factor code.
        </p>
        <p>
          You may ask us to close the account. Closing it removes your sign-in. It does not
          automatically erase conference records that an organizer must keep, as described in the
          Privacy policy.
        </p>
      </>
    ),
  },
  {
    id: 'organizers',
    title: 'Organizers',
    body: (
      <>
        <p>If you organize or chair a conference, you agree that:</p>
        <ul>
          <li>You have authority to configure that conference and to invite its participants.</li>
          <li>
            You will use participant information only for that conference, and you will not export
            it for unrelated marketing.
          </li>
          <li>
            You are responsible for the call for papers, review policy, blinding choice, deadlines,
            decisions, and registration fees you set.
          </li>
          <li>
            You will not assign a reviewer to a paper when the Platform reports an authorship or
            other conflict, and you will not try to bypass those checks.
          </li>
          <li>
            API keys you issue act for your conference. You will give a key only the access it
            needs, store it as a secret, and revoke it when it is no longer required.
          </li>
        </ul>
        <p>
          A decision recorded on the Platform is your conference’s decision. FresiCMT does not
          review the scholarly merits of a paper.
        </p>
      </>
    ),
  },
  {
    id: 'participants',
    title: 'Authors and reviewers',
    body: (
      <>
        <p>If you submit or review, you agree that:</p>
        <ul>
          <li>
            Authorship information is accurate, and each coauthor you name has agreed to be listed.
          </li>
          <li>
            You will declare conflicts the conference asks for, including when your email is already
            associated with a paper.
          </li>
          <li>
            A reviewer invitation must be accepted with the invited email address. Accepting adds
            reviewer access to that account and leaves any author role you already have in place.
          </li>
          <li>
            You will not review a paper you authored. The Platform blocks that assignment; do not
            try to route around it with another account.
          </li>
          <li>
            Review files, scores, and confidential comments are for the assignment only. Do not
            redistribute a manuscript or a review outside the people the conference authorizes.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <>
        <p>
          You keep ownership of the manuscripts, reviews, and other material you submit (“your
          content”). You give FresiCMT a non-exclusive license to host, store, display, and transmit
          that content only as needed to operate the Platform for you and for the conference you
          submitted it to. This license ends when the content is deleted from the Platform, except
          for copies kept in backups or in a conference record the organizer is entitled to retain.
        </p>
        <p>
          You represent that you have the rights needed to submit the content, and that doing so
          does not infringe someone else’s copyright, privacy, or other right.
        </p>
        <p>
          We may remove content that violates these terms or the law. We do not pre-screen every
          upload. We are not the publisher of a paper or a review.
        </p>
        <p>
          The FresiCMT name, interface, and software are ours or our licensors’. You may not copy
          the software, scrape the service, or reuse another participant’s content except as your
          role on that conference allows.
        </p>
      </>
    ),
  },
  {
    id: 'payments',
    title: 'Registration payments',
    body: (
      <>
        <p>
          Registration fees are set by the conference organizer, not by these terms. When a fee is
          charged, payment is collected by Razorpay. Your payment relationship for the charge is
          with the organizer and the payment provider. We record the status so the conference can
          see whether registration is paid.
        </p>
        <p>
          Refunds, if any, follow the organizer’s registration rules and what the payment provider
          can process. FresiCMT does not promise a refund because a paper outcome changes after a
          fee was paid, unless the organizer issues one.
        </p>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You may not:</p>
        <ul>
          <li>Break the law, or help someone else break it, using the Platform.</li>
          <li>
            Probe, scan, or attack the Platform, or bypass a role, blinding, or conflict check.
          </li>
          <li>Upload malware, or interfere with the service for other users.</li>
          <li>
            Send spam, or harvest participant email addresses for a purpose outside the conference.
          </li>
          <li>Misrepresent your identity, affiliation, or authorship.</li>
          <li>Share sign-in credentials, invitation tokens, or API keys publicly.</li>
          <li>
            Use an automated client against the Platform except through a conference API key that an
            organizer issued to you, and only within that key’s scopes.
          </li>
        </ul>
        <p>
          We may suspend an account, revoke a role, or disable a key if we reasonably believe these
          terms were broken. Where we can do so without putting another user at risk, we will tell
          you why.
        </p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and support',
    body: (
      <p>
        The Platform is provided as available. Maintenance, provider outages, and failures can
        interrupt access. We do not offer a guaranteed uptime or a guaranteed response time. Support
        requests go to <a href="mailto:contact@fresi.org">contact@fresi.org</a>.
      </p>
    ),
  },
  {
    id: 'privacy',
    title: 'Personal information',
    body: (
      <p>
        We handle personal information as described in the <a href="/privacy">Privacy policy</a>.
        Using the Platform includes the processing that policy describes. Organizers handle
        conference records for their conference. A request about a paper or registration may need to
        go to that organizer.
      </p>
    ),
  },
  {
    id: 'feedback',
    title: 'Feedback',
    body: (
      <p>
        If you send us ideas or suggestions, you allow us to use them without payment or
        confidentiality, unless we have agreed otherwise in writing. Do not send us information you
        are not free to share.
      </p>
    ),
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: (
      <p>
        The Platform links to or relies on services we do not control, including Razorpay, email
        delivery, and file hosting. Their terms apply to their part of the transaction. A link is
        not an endorsement of a conference, a paper, or an external site.
      </p>
    ),
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer',
    body: (
      <p>
        The Platform is provided “as is” and “as available.” To the extent the law allows, we
        disclaim warranties of merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant that a submission was received by a reviewer, that a
        decision is correct, that a file is free of harmful code, or that a conference will proceed.
        Scholarly judgment stays with the conference.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: (
      <>
        <p>
          To the extent the law allows, FresiCMT and its operators are not liable for indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, lost data,
          or a conference’s acceptance or rejection of a paper, arising out of your use of the
          Platform.
        </p>
        <p>
          To the extent the law allows, our total liability for a claim relating to the Platform is
          limited to the amount you paid to FresiCMT for the Platform in the three months before the
          claim. Registration fees paid to a conference through Razorpay are not fees paid to
          FresiCMT unless we say so in a separate written agreement.
        </p>
        <p>
          Nothing in these terms excludes liability that applicable law does not allow us to
          exclude, including liability for fraud.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    title: 'Indemnity',
    body: (
      <p>
        You will defend and indemnify FresiCMT and its operators against claims, losses, and
        reasonable legal fees arising from your content, your conference’s decisions, or your breach
        of these terms, except to the extent the claim is caused by our fraud or wilful misconduct.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of India. Courts in India have exclusive jurisdiction,
        except where the law gives you a right to bring a claim in another court that we cannot
        waive. If a provision cannot be enforced, the rest of these terms still apply.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes',
    body: (
      <p>
        We may update these terms. The new version will be posted on this page with a new date. If
        you have an account and the change is material, we will email the address on the account
        before it takes effect. Continuing to use the Platform after that date means you accept the
        updated terms. If you do not accept them, stop using the Platform and ask us to close the
        account.
      </p>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    body: (
      <p>
        Questions about these terms: <a href="mailto:contact@fresi.org">contact@fresi.org</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of use"
      updated={updated}
      lede="These terms govern use of FresiCMT. They cover the account you sign in with and the conference work that account is allowed to do."
      sections={sections}
    />
  );
}
