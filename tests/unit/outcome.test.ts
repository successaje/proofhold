import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  medianTimeToDecision,
  outcomeLine,
  timeToDecision,
} from "../../src/lib/domain/outcome";

const base = {
  amountCents: 42_000,
  releasedCents: 0,
  currency: "USD",
  evidenceSubmittedAt: "2026-10-28T10:00:00.000Z",
  decidedAt: "2026-10-28T12:14:00.000Z",
};

test("time to decision is measured from submission and tolerates missing stamps", () => {
  assert.equal(timeToDecision(base), 134 * 60_000);
  assert.equal(timeToDecision({ ...base, decidedAt: null }), null);
  assert.equal(
    timeToDecision({ ...base, decidedAt: "2026-10-28T09:00:00.000Z" }),
    null,
    "a decision before submission is not a duration",
  );
});

test("durations read like a person wrote them", () => {
  assert.equal(formatDuration(20_000), "under a minute");
  assert.equal(formatDuration(7 * 60_000), "7 min");
  assert.equal(formatDuration(134 * 60_000), "2 h 14 min");
  assert.equal(formatDuration(3 * 3_600_000), "3 h");
  assert.equal(formatDuration(50 * 3_600_000), "2 d 2 h");
});

test("outcome lines name the money and the time", () => {
  assert.equal(
    outcomeLine({ ...base, status: "released", releasedCents: 42_000 }),
    "Released $420.00 · 2 h 14 min from submission",
  );
  assert.equal(
    outcomeLine({ ...base, status: "partially_released", releasedCents: 21_000 }),
    "Released $210.00 · returned $210.00 · 2 h 14 min from submission",
  );
  assert.equal(
    outcomeLine({ ...base, status: "voided", decidedAt: null }),
    "Hold returned to the buyer",
  );
  assert.equal(
    outcomeLine({ ...base, status: "cancelled" }),
    "Cancelled before any money was held",
  );
  assert.equal(outcomeLine({ ...base, status: "held" }), null);
});

test("median time to decision only counts releases", () => {
  const at = (minutes: number) => ({
    evidenceSubmittedAt: "2026-10-28T10:00:00.000Z",
    decidedAt: new Date(
      Date.parse("2026-10-28T10:00:00.000Z") + minutes * 60_000,
    ).toISOString(),
  });
  assert.equal(medianTimeToDecision([]), null);
  assert.equal(
    medianTimeToDecision([
      { status: "released", ...at(10) },
      { status: "voided", ...at(1000) },
      { status: "partially_released", ...at(30) },
      { status: "released", ...at(20) },
    ]),
    20 * 60_000,
  );
  assert.equal(
    medianTimeToDecision([
      { status: "released", ...at(10) },
      { status: "released", ...at(30) },
    ]),
    20 * 60_000,
  );
});
