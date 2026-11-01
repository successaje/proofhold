import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "What Proofhold does and does not do with your payment.",
};

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="1 November 2026">
      <p>
        Proofhold is open-source software that binds a PayPal authorization to an
        acceptance test both parties approve. These terms describe what the service does.
        They are written for this deployment and are not legal advice.
      </p>
      <h2>What Proofhold does</h2>
      <ul>
        <li>
          Compiles a seller's brief into an acceptance test, shows that test to the buyer,
          and records both parties' agreement with a hash.
        </li>
        <li>
          Creates a PayPal order with intent AUTHORIZE when the buyer approves. PayPal
          holds the funds; Proofhold never receives them.
        </li>
        <li>
          Runs deterministic checks on delivered evidence, asks an examiner to judge what
          a machine cannot measure, and records a decision. Only a recorded decision
          captures, partially captures or voids the authorization.
        </li>
        <li>
          After a capture, hands PayPal's own dispute process the evidence bundle when a
          buyer disputes.
        </li>
      </ul>
      <h2>What Proofhold does not do</h2>
      <ul>
        <li>
          It does not hold, transfer or pay out money. PayPal's terms govern the payment.
        </li>
        <li>
          It does not decide who is right. The test both parties approved decides; where
          the test cannot, the buyer's confirmation or objection decides; after a capture,
          PayPal decides.
        </li>
        <li>
          It does not guarantee the examiner's judgement. Any judgement line can be
          overridden by the buyer, and an uncertain examiner abstains rather than
          releasing money.
        </li>
      </ul>
      <h2>Your responsibilities</h2>
      <ul>
        <li>
          Sellers: write a test that describes the work honestly; deliver what it says.
        </li>
        <li>
          Buyers: read the test before approving; object within the window if the delivery
          does not match it. Silence past the window is acceptance.
        </li>
        <li>Both: keep the buyer link private. Anyone with it can act as the buyer.</li>
      </ul>
      <h2>Modes</h2>
      <p>
        Every page states whether PayPal is the sandbox or a simulation, and whether the
        examiner is on, simulated or off. Nothing shown in a simulated mode is a real
        payment or a real judgement.
      </p>
      <h2>Liability</h2>
      <p>
        The software is provided under the MIT licence, as is, without warranty. The
        operator of this deployment is not a party to the agreement between buyer and
        seller.
      </p>
    </LegalPage>
  );
}
