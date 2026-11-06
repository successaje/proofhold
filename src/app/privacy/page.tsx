import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Proofhold stores, for how long, and how to delete it.",
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="1 November 2026">
      <p>
        Proofhold collects only what the agreement needs. This page lists it. No
        regulatory compliance is claimed; the operator of this deployment is responsible
        for the obligations that apply to them.
      </p>
      <h2>What is stored</h2>
      <ul>
        <li>
          <strong>Seller workspace:</strong> a name and a PayPal email, and a signed
          cookie in the seller's browser that names the workspace. No password.
        </li>
        <li>
          <strong>Each proofhold:</strong> the brief, the acceptance test and its hash,
          the amount, the buyer's name and email as the buyer typed them, the PayPal
          order, authorization, capture and dispute identifiers, and the PayPal account
          email that approved the hold.
        </li>
        <li>
          <strong>Evidence:</strong> the files the seller uploads, their fingerprints and
          measured metadata, tracking numbers, and the seller's and buyer's messages.
        </li>
        <li>
          <strong>Record:</strong> a hash-chained log of every state change, and the
          examiner's verdicts and reasons.
        </li>
        <li>
          <strong>Logs:</strong> request logs with a request id, method, path, status and
          duration. Emails are partially masked and secrets are redacted before writing.
        </li>
      </ul>
      <h2>Who sees it</h2>
      <ul>
        <li>
          The seller sees their own proofholds. The buyer sees one proofhold, through its
          link.
        </li>
        <li>
          PayPal receives the order, the amount, the test hash as the order's custom id,
          the tracking number after capture, and the evidence bundle if a dispute is
          filed.
        </li>
        <li>
          When the examiner is on, the evidence and the test are sent to the model
          provider named in Settings to produce a verdict. When it is off or simulated,
          nothing leaves this deployment.
        </li>
        <li>
          When mail is configured, the provider named in Settings receives the addresses
          and the notification text. When it is simulated, mail stays in the outbox here.
        </li>
      </ul>
      <h2>How long</h2>
      <p>
        Until the seller deletes the workspace from Settings, which removes the workspace,
        its proofholds, evidence and record. Backups the operator takes are retained on
        the operator's schedule. Records PayPal holds follow PayPal's retention.
      </p>
      <h2>Cookies</h2>
      <p>
        One cookie, <code>ph_workspace</code>, identifies the seller's browser. It is
        HttpOnly, SameSite, secure over HTTPS, and lasts a year or until sign-out. No
        analytics or advertising cookies.
      </p>
    </LegalPage>
  );
}
