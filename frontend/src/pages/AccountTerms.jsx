import './account-terms.scss';

export default function AccountTerms() {
  return (
    <main className="container account-terms">
      <header className="account-terms-header">
        <p className="eyebrow">PropFlow · Compliance</p>
        <h1 className="page-title">Account Terms and Conditions</h1>
        <p className="subtle">Last updated: November 1, 2026</p>
      </header>

      <article className="card account-terms-document">
        <p className="account-terms-draft" role="note">
          Draft for review. These standard terms are a starting point for a Canadian property marketplace and should be reviewed for your business, province or territory, and applicable laws before publication.
        </p>

        <p>
          These Account Terms and Conditions (the “Terms”) apply to your access to and use of PropFlow (the “Platform”). By creating an account or using the Platform, you agree to these Terms. If you do not agree, do not create an account or use the Platform.
        </p>

        <section>
          <h2>1. Eligibility and your account</h2>
          <p>
            You must be able to form a binding agreement under the laws that apply to you and be at least the age of majority in your province or territory to create an account. You agree to provide accurate, current information and keep it up to date. You are responsible for keeping your sign-in credentials confidential and for activity through your account. Notify us promptly if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2>2. Using the Platform</h2>
          <p>
            The Platform provides tools to discover and publish property listings, express interest, request viewings, and communicate with other users. Unless we expressly state otherwise, PropFlow is a technology marketplace and is not a party to transactions between users, does not act as your real estate representative, and does not provide legal, financial, tax, or investment advice.
          </p>
          <p>
            You are responsible for independently verifying property information, availability, pricing, and the identity and authority of other users. A listing or other Platform content is not a guarantee, offer, or professional recommendation.
          </p>
        </section>

        <section>
          <h2>3. Listings and user conduct</h2>
          <p>
            You may submit content only when you have the rights and authority to do so. Information you provide must be accurate, lawful, and not misleading. You must not impersonate another person, post fraudulent or unauthorized listings, harass others, misuse personal information, interfere with the Platform, or use it for an unlawful purpose.
          </p>
          <p>
            You remain responsible for your content and interactions. You grant PropFlow permission to host, display, and use content you submit as reasonably needed to operate and improve the Platform and provide its features.
          </p>
        </section>

        <section>
          <h2>4. Identity checks and compliance</h2>
          <p>
            Some features, including publishing a property listing, may require identity verification or other compliance checks. You agree to provide requested information that is accurate and belongs to you. Submitting information does not guarantee verification, approval, or access to a feature. We may review, restrict, or remove content or access where reasonably necessary for safety, compliance, or enforcement of these Terms.
          </p>
          <p>
            Personal information and verification documents are handled in accordance with applicable Canadian privacy laws and the Platform’s privacy practices.
          </p>
        </section>

        <section>
          <h2>5. Account restrictions and termination</h2>
          <p>
            We may suspend or restrict an account or remove content if we reasonably believe these Terms or applicable law have been breached, or if action is needed to protect users or the Platform. You may stop using the Platform and request account closure through the available account or support channels. Some information may be retained where required or permitted by law.
          </p>
        </section>

        <section>
          <h2>6. Platform availability and liability</h2>
          <p>
            We work to keep the Platform available and reliable, but do not guarantee uninterrupted or error-free access. To the extent permitted by applicable law, the Platform is provided without warranties beyond those that cannot legally be excluded. Nothing in these Terms limits any rights or remedies that cannot be limited under applicable consumer protection or other laws.
          </p>
          <p>
            To the extent permitted by applicable law, PropFlow is not responsible for indirect or consequential loss arising from your use of the Platform or dealings with other users. This does not exclude liability that cannot legally be excluded or limited.
          </p>
        </section>

        <section>
          <h2>7. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. Where required by law, we will provide notice and obtain your agreement before an update applies. The updated Terms will show a revised “Last updated” date. If you do not agree to an update, stop using the Platform and contact us about your account.
          </p>
        </section>

        <section>
          <h2>8. Applicable law</h2>
          <p>
            These Terms are subject to applicable federal laws of Canada and the laws that apply in the province or territory relevant to your use of the Platform. Mandatory rights and protections under applicable law continue to apply.
          </p>
        </section>
      </article>
    </main>
  );
}
