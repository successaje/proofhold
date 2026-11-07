/**
 * Seeds one workspace with proofholds in every state, through the real
 * services, so records, verdicts, outbox and hash chains are genuine. Used by
 * `npm run seed`, the screenshot script and the demo recording.
 */
import { createHmac } from "node:crypto";
import { pngFixture } from "./png";

export interface SeededRow {
  state: string;
  title: string;
  id: string;
  token: string;
}

export interface Seeded {
  workspaceId: string;
  workspaceName: string;
  cookie: string;
  rows: SeededRow[];
  appUrl: string;
  mode: string;
}

export async function seedWorkspace(): Promise<Seeded> {
  const { config } = await import("../src/lib/config");
  const { db, closeDb } = await import("../src/lib/store/sql");
  const { createWorkspace } = await import("../src/lib/store/repos");
  const { createDraft, propose, cancel } = await import("../src/lib/proofholds/compose");
  const { starterTest } = await import("../src/lib/compiler/starters");
  const { startApproval, completeApproval } =
    await import("../src/lib/proofholds/approval");
  const { addFile, addTracking, submit, runExaminer } =
    await import("../src/lib/proofholds/evidence");
  const { confirm, object, proposeOffer, acceptOffer, declineOffer } =
    await import("../src/lib/proofholds/buyer");
  const { openSandboxDispute, fileEvidence } =
    await import("../src/lib/proofholds/disputes");
  const { paypal } = await import("../src/lib/paypal");
  const { acceptanceTestSchema } = await import("../src/lib/domain/test");

  const sql = await db();
  const c = config();
  const simulated = c.paypal.mode === "simulated";
  const ws = await createWorkspace(sql, {
    name: "Ada Mensah",
    email: "ada@studio.example.com",
  });
  const buyer = { name: "Bea Okafor", email: "bea@personal.example.com" };

  type Kind = "service" | "goods";
  const brief = {
    logos:
      "Three logo concepts for a small coastal café called Driftwood. Minimal, two colours at most, must work at favicon size. Deliver as PNG at 300 dpi plus SVG. Due by Friday.",
    phone:
      "Used iPhone 13, 128 GB, blue, battery health 88%, no cracks, factory reset, original box. Ships tracked within two days of approval.",
    copy: "Headline, subhead and five sections of copy for a landscaping company's new site, delivered as a Markdown file. British English. Due in one week.",
    deck: "A twelve-slide investor deck in PDF. Our numbers, our template, no stock photos. Due within 5 days.",
    photos:
      "Twenty product photos of the ceramic range on a plain background, PNG, at least 2000px wide. Due by Thursday.",
  };

  async function draft(
    title: string,
    kind: Kind,
    text: string,
    amountCents: number,
    test = starterTest({ brief: text, kind, amountCents, currency: "USD" }),
  ) {
    const ph = await createDraft(sql, ws.id, {
      title,
      kind,
      brief: text,
      amountCents,
      currency: "USD",
      buyerEmail: buyer.email,
      test,
    });
    return propose(sql, ph);
  }

  async function approve(ph: Awaited<ReturnType<typeof draft>>) {
    const pp = await paypal();
    const { orderId } = await startApproval(sql, ph, buyer);
    await pp.simulateApproval!(orderId, buyer);
    return completeApproval(sql, orderId);
  }

  async function deliver(
    ph: Awaited<ReturnType<typeof draft>>,
    files: [string, number, number, number][],
    note: string,
  ) {
    let current = ph;
    for (const [name, w, h, hue] of files)
      await addFile(sql, current, {
        name,
        bytes: pngFixture(w, h, 300, hue),
        declaredMime: "image/png",
      });
    const result = await submit(sql, current, note);
    current = result.proofhold;
    if (result.needsExaminer) current = await runExaminer(sql, current);
    const { getProofhold } = await import("../src/lib/store/repos");
    return (await getProofhold(sql, current.id))!;
  }

  /** A test with only measurable lines, so a clean delivery releases on silence. */
  function measurableLogoTest() {
    return acceptanceTestSchema.parse({
      version: 1,
      summary: "Three logo concepts for Driftwood Café, PNG at 300 dpi",
      predicates: [
        {
          id: "p1",
          text: "Three concept files as PNG",
          evidence: "file",
          must_pass: true,
          check: { kind: "count", min: 3, mime: ["image/png"] },
        },
        {
          id: "p2",
          text: "Raster images are at least 300 dpi",
          evidence: "file",
          must_pass: true,
          check: { kind: "dpi", min: 300 },
        },
        {
          id: "p3",
          text: "Images are at least 1000px wide",
          evidence: "file",
          must_pass: true,
          check: { kind: "dimensions", min_width: 1000 },
        },
      ],
      rules: {
        silence_window_hours: 72,
        partial_release: [{ when_passed: ["p1", "p2"], fraction: 0.6 }],
      },
      unclear: [],
    });
  }

  const rows: SeededRow[] = [];
  const row = (state: string, ph: { title: string; id: string; buyerToken: string }) =>
    rows.push({ state, title: ph.title, id: ph.id, token: ph.buyerToken });

  // 1. Sent, awaiting the buyer.
  row(
    "proposed",
    await draft("Landing page copy, five sections", "service", brief.copy, 18000),
  );

  // 2. Cancelled before approval.
  {
    const ph = await draft("Investor deck, twelve slides", "service", brief.deck, 95000);
    row("cancelled", await cancel(sql, ph, "seller"));
  }

  if (simulated) {
    // 3. Held, waiting for delivery (goods with tracking).
    row(
      "held",
      await approve(await draft("iPhone 13, 128 GB, blue", "goods", brief.phone, 31000)),
    );

    // 4. Buyer window open on a delivery every measurable line passed: releases on silence.
    {
      let ph = await approve(
        await draft(
          "Logo concepts for Driftwood Café",
          "service",
          brief.logos,
          42000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["driftwood-a.png", 1600, 1200, 0],
          ["driftwood-b.png", 1600, 1200, 60],
          ["driftwood-c.png", 1600, 1200, 120],
        ],
        "Three concepts attached. B is my favourite.",
      );
      row("awaiting_buyer", ph);
    }

    // 5. Blocked: the judgement line could not be checked by a machine, so the buyer decides.
    {
      let ph = await approve(
        await draft("Product photos, ceramic range", "service", brief.photos, 64000),
      );
      ph = await deliver(
        ph,
        Array.from(
          { length: 4 },
          (_, i) =>
            [`ceramic-${i + 1}.png`, 2400, 1600, i * 40] as [
              string,
              number,
              number,
              number,
            ],
        ),
        "First four of twenty; the rest follow tomorrow.",
      );
      row(ph.status, ph);
    }

    // 6. In review: the buyer objected, the seller offered a partial release.
    {
      let ph = await approve(
        await draft(
          "Logo concepts, second round",
          "service",
          brief.logos,
          42000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["concept-a.png", 1600, 1200, 0],
          ["concept-b.png", 1600, 1200, 60],
          ["concept-c.png", 1600, 1200, 120],
        ],
        "Second round as discussed.",
      );
      ph = await object(
        sql,
        ph,
        "Concept C is the same as the first round with the colours swapped. I asked for three distinct directions.",
      );
      ph = await proposeOffer(sql, ph, {
        amountCents: 28000,
        note: "Fair point on C. Take A and B for two thirds and I will drop C.",
      });
      row("in_review", ph);
    }

    // 7. Released in full: the buyer confirmed. Also where a dispute can be demonstrated.
    {
      let ph = await approve(
        await draft(
          "Logo concepts for Driftwood Café (March)",
          "service",
          brief.logos,
          42000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["driftwood-a.png", 1600, 1200, 0],
          ["driftwood-b.png", 1600, 1200, 60],
          ["driftwood-c.png", 1600, 1200, 120],
        ],
        "Final files.",
      );
      ph = await confirm(sql, ph, "Lovely. Going with B.");
      row("released", ph);
    }

    // 8. Partly released: the buyer accepted an offer.
    {
      let ph = await approve(
        await draft(
          "Brand guidelines, short edition",
          "service",
          brief.logos,
          60000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["guide-cover.png", 1600, 1200, 0],
          ["guide-marks.png", 1600, 1200, 60],
          ["guide-type.png", 1600, 1200, 120],
        ],
        "Cover, marks and type pages.",
      );
      ph = await object(sql, ph, "The type page is missing the web sizes we agreed.");
      ph = await proposeOffer(sql, ph, {
        amountCents: 45000,
        note: "Three quarters for what is there; I will send the web sizes separately.",
      });
      ph = await acceptOffer(sql, ph);
      row("partially_released", ph);
    }

    // 9. Returned: the buyer declined the offer and the hold was voided.
    {
      let ph = await approve(
        await draft(
          "Poster series, three designs",
          "service",
          brief.logos,
          36000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["poster-1.png", 1600, 1200, 0],
          ["poster-2.png", 1600, 1200, 60],
          ["poster-3.png", 1600, 1200, 120],
        ],
        "Three posters.",
      );
      ph = await object(
        sql,
        ph,
        "These are not the sizes we agreed and the colours are off.",
      );
      ph = await proposeOffer(sql, ph, {
        amountCents: 12000,
        note: "A third for the first poster.",
      });
      ph = await declineOffer(sql, ph, "No, let's call it off.");
      row("voided", ph);
    }

    // 10. Disputed after capture: PayPal decides, the evidence bundle is filed.
    {
      let ph = await approve(
        await draft(
          "Menu illustration set",
          "service",
          brief.logos,
          24000,
          measurableLogoTest(),
        ),
      );
      ph = await deliver(
        ph,
        [
          ["menu-a.png", 1600, 1200, 0],
          ["menu-b.png", 1600, 1200, 60],
          ["menu-c.png", 1600, 1200, 120],
        ],
        "Illustrations attached.",
      );
      ph = await confirm(sql, ph, null);
      ph = await openSandboxDispute(sql, ph, {
        reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
      });
      ph = await fileEvidence(sql, ph);
      row("disputed", ph);
    }
  }

  const sig = createHmac("sha256", c.APP_SECRET).update(ws.id).digest("base64url");
  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    cookie: `${ws.id}.${sig}`,
    rows,
    appUrl: c.APP_URL,
    mode: `${c.paypal.mode} PayPal, examiner ${c.examiner.mode}, mail ${c.mail.provider}`,
  };
}
