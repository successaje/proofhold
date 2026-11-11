/**
 * One template per event and audience. Plain text first; the HTML is the same
 * words in a narrow card with one button. The voice is the product's: say what
 * happened, what it means for the reader, and the one thing they can do.
 */
import { formatAmount, type Proofhold } from "../domain/proofhold";

export type MailEvent =
  | "proposed"
  | "approved"
  | "window_open"
  | "window_blocked"
  | "review"
  | "offer"
  | "released"
  | "partially_released"
  | "voided"
  | "expired"
  | "disputed"
  | "dispute_resolved"
  | "reminder_window"
  | "reminder_expiry"
  | "reopened";

export interface TemplateInput {
  ph: Proofhold;
  sellerName: string;
  buyerUrl: string;
  sellerUrl: string;
  recordUrl: string;
  extra?: Record<string, string | number | null | undefined>;
}

export interface Rendered {
  subject: string;
  text: string;
  html: string;
  cta: { label: string; url: string };
}

function money(ph: Proofhold, cents = ph.amountCents) {
  return formatAmount(cents, ph.currency);
}

type Spec = {
  subject: string;
  lines: string[];
  cta: { label: string; url: string };
};

export function template(
  event: MailEvent,
  audience: "seller" | "buyer",
  i: TemplateInput,
): Rendered | null {
  const { ph, sellerName, buyerUrl, sellerUrl, recordUrl } = i;
  const window = ph.test.rules.silence_window_hours;
  const specs: Partial<Record<MailEvent, Partial<Record<"seller" | "buyer", Spec>>>> = {
    proposed: {
      buyer: {
        subject: `${sellerName} sent you a payment hold to approve: ${ph.title}`,
        lines: [
          `${sellerName} is asking you to approve a PayPal hold of ${money(ph)} for "${ph.title}".`,
          "Nothing is charged now. PayPal reserves the money in your account and releases it only when the agreed test is met, or when you say so.",
          "Read the test on the page before you approve. It is the whole agreement.",
        ],
        cta: { label: "Read the test and approve", url: buyerUrl },
      },
    },
    approved: {
      seller: {
        subject: `Held: ${money(ph)} for ${ph.title}`,
        lines: [
          `${ph.buyerName ?? "The buyer"} approved. PayPal is holding ${money(ph)} against the test you both agreed.`,
          ph.authorizationExpiresAt
            ? `The hold is valid until ${new Date(ph.authorizationExpiresAt).toUTCString()}. Deliver through Proofhold before then.`
            : "Deliver through Proofhold.",
        ],
        cta: { label: "Deliver", url: sellerUrl },
      },
    },
    window_open: {
      buyer: {
        subject: `Delivered: ${ph.title}. You have ${window} hours to object`,
        lines: [
          `${sellerName} delivered and every required line of the test passed.`,
          `If you do nothing, PayPal releases ${money(ph, ph.amountCents - ph.releasedCents)} to ${sellerName} when the window closes. Confirm to release now, or object with a reason to stop it.`,
        ],
        cta: { label: "Review the delivery", url: buyerUrl },
      },
    },
    window_blocked: {
      buyer: {
        subject: `Your decision is needed: ${ph.title}`,
        lines: [
          `${sellerName} delivered, but at least one line of the test could not be passed by a check. Nothing releases until you decide.`,
          `Nothing releases automatically. Confirm to release, or object with a reason.${
            ph.authorizationExpiresAt
              ? ` The PayPal hold itself lasts until ${new Date(ph.authorizationExpiresAt).toUTCString()}; after that it lapses and nothing is paid.`
              : ""
          }`,
        ],
        cta: { label: "Review and decide", url: buyerUrl },
      },
    },
    review: {
      seller: {
        subject: `Objection on ${ph.title}`,
        lines: [
          `${ph.buyerName ?? "The buyer"} objected to the delivery. Nothing has been captured.`,
          "You can offer a partial release, add evidence and resubmit, or end the hold and return the money.",
        ],
        cta: { label: "Respond", url: sellerUrl },
      },
    },
    offer: {
      buyer: {
        subject: `${sellerName} offered a partial release on ${ph.title}`,
        lines: [
          `${sellerName} offers to take ${money(ph, ph.offerCents ?? 0)} and return the rest to you.`,
          "Accept to settle it that way, or decline to have the whole hold returned.",
        ],
        cta: { label: "See the offer", url: buyerUrl },
      },
    },
    released: {
      seller: {
        subject: `Released: ${money(ph, ph.releasedCents)} for ${ph.title}`,
        lines: [
          `PayPal captured ${money(ph, ph.releasedCents)}. The capture id is on the record.`,
          "The record, with every check and its reasons, is yours to keep.",
        ],
        cta: { label: "Open the record", url: recordUrl },
      },
      buyer: {
        subject: `Receipt: ${money(ph, ph.releasedCents)} paid to ${sellerName} for ${ph.title}`,
        lines: [
          `PayPal captured ${money(ph, ph.releasedCents)} from your hold and paid ${sellerName}.`,
          "Your receipt lists the test, every check that passed, and the PayPal ids. If something is wrong later, PayPal's dispute process applies.",
        ],
        cta: { label: "Open your receipt", url: `${buyerUrl}/record` },
      },
    },
    partially_released: {
      seller: {
        subject: `Partly released: ${money(ph, ph.releasedCents)} for ${ph.title}`,
        lines: [
          `PayPal captured ${money(ph, ph.releasedCents)} and returned ${money(ph, ph.amountCents - ph.releasedCents)} to the buyer, as the test's rules or your offer said.`,
        ],
        cta: { label: "Open the record", url: recordUrl },
      },
      buyer: {
        subject: `Receipt: ${money(ph, ph.releasedCents)} paid, ${money(ph, ph.amountCents - ph.releasedCents)} returned`,
        lines: [
          `PayPal captured ${money(ph, ph.releasedCents)} for ${sellerName} and released the rest of the hold back to you.`,
        ],
        cta: { label: "Open your receipt", url: `${buyerUrl}/record` },
      },
    },
    voided: {
      seller: {
        subject: `Hold returned: ${ph.title}`,
        lines: [
          "The hold went back to the buyer. No money moved.",
          "If you agree new terms, start another from this test.",
        ],
        cta: { label: "Open the proofhold", url: sellerUrl },
      },
      buyer: {
        subject: `Nothing was charged: ${ph.title}`,
        lines: [
          `The PayPal hold of ${money(ph, ph.amountCents - ph.releasedCents)} was returned to you in full. If PayPal still shows the reservation, it clears within a few days depending on your bank.`,
        ],
        cta: { label: "See the record", url: buyerUrl },
      },
    },
    expired: {
      seller: {
        subject: `Hold expired: ${ph.title}`,
        lines: [
          "The PayPal authorization lapsed before a decision. Nothing was charged.",
          "Send the buyer a fresh link if the work is still on.",
        ],
        cta: { label: "Start another from this test", url: sellerUrl },
      },
      buyer: {
        subject: `Nothing was charged: ${ph.title}`,
        lines: [
          "The PayPal authorization lapsed, so the reservation was released on its own.",
        ],
        cta: { label: "See the record", url: buyerUrl },
      },
    },
    disputed: {
      seller: {
        subject: `PayPal dispute opened on ${ph.title}`,
        lines: [
          `${ph.buyerName ?? "The buyer"} opened a PayPal dispute on the capture. From here PayPal decides.`,
          "File the evidence bundle from the proofhold page; it contains the agreed test, every check and its reasons, and the hash-chained history.",
        ],
        cta: { label: "File the evidence", url: sellerUrl },
      },
    },
    dispute_resolved: {
      seller: {
        subject: `Dispute resolved: ${ph.title}`,
        lines: [
          `PayPal resolved the dispute: ${String(i.extra?.outcome ?? "see the record")}.`,
        ],
        cta: { label: "Open the record", url: recordUrl },
      },
      buyer: {
        subject: `Dispute resolved: ${ph.title}`,
        lines: [
          `PayPal resolved the dispute: ${String(i.extra?.outcome ?? "see the record")}.`,
        ],
        cta: { label: "See the record", url: buyerUrl },
      },
    },
    reopened: {
      buyer: {
        subject: `${sellerName} withdrew the delivery for ${ph.title}`,
        lines: [
          `${sellerName} took the delivery back to change it. The window to object is cancelled and nothing has been captured.`,
          "You will be written to again when the new delivery is ready and the checks have run.",
        ],
        cta: { label: "See the hold", url: buyerUrl },
      },
    },
    reminder_window: {
      buyer: {
        subject: `Closing soon: ${ph.title}`,
        lines: [
          `The window to object closes ${String(i.extra?.closesAt ?? "soon")}. After that PayPal releases ${money(ph, ph.amountCents - ph.releasedCents)} to ${sellerName}.`,
          "If the delivery matches the test, you need do nothing.",
        ],
        cta: { label: "Review the delivery", url: buyerUrl },
      },
    },
    reminder_expiry: {
      seller: {
        subject: `Hold expires soon: ${ph.title}`,
        lines: [
          `The PayPal hold of ${money(ph)} expires ${String(i.extra?.expiresAt ?? "soon")}. Deliver through Proofhold before then or the reservation lapses.`,
        ],
        cta: { label: "Deliver", url: sellerUrl },
      },
    },
  };
  const spec = specs[event]?.[audience];
  if (!spec) return null;
  const text = [
    ...spec.lines,
    "",
    `${spec.cta.label}: ${spec.cta.url}`,
    "",
    "Proofhold never holds the money; PayPal does, under the test both sides approved.",
  ].join("\n");
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f4ef;font-family:Inter,system-ui,sans-serif;color:#17150f">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
<div style="font-family:Georgia,serif;font-size:20px;color:#0d5c4e;margin-bottom:20px">Proofhold</div>
<div style="background:#fff;border:1px solid #e1ddd4;border-radius:12px;padding:24px">
<h1 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:0 0 16px">${esc(spec.subject)}</h1>
${spec.lines.map((l) => `<p style="margin:0 0 12px;line-height:1.5;color:#4b4740">${esc(l)}</p>`).join("")}
<p style="margin:20px 0 0"><a href="${esc(spec.cta.url)}" style="display:inline-block;background:#0d5c4e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">${esc(spec.cta.label)}</a></p>
</div>
<p style="font-size:12px;color:#6b665e;margin-top:16px">Proofhold never holds the money; PayPal does, under the test both sides approved.</p>
</div></body></html>`;
  return { subject: spec.subject, text, html, cta: spec.cta };
}
