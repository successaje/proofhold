import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RateLimiter,
  clientAddress,
  isSameOrigin,
  rateRuleFor,
  securityHeaders,
} from "../../src/lib/security";
import { redact } from "../../src/lib/log";

const h = (o: Record<string, string>) => ({
  get: (k: string) => o[k.toLowerCase()] ?? null,
});
const app = "https://proofhold.example";

test("cross-site and anonymous mutations are refused; same-site calls pass", () => {
  assert.equal(
    isSameOrigin(
      h({ "sec-fetch-site": "cross-site", origin: "https://evil.example" }),
      app,
    ),
    false,
  );
  assert.equal(isSameOrigin(h({ origin: "https://evil.example" }), app), false);
  assert.equal(
    isSameOrigin(h({ "sec-fetch-site": "same-origin", origin: app }), app),
    true,
  );
  assert.equal(isSameOrigin(h({ origin: app }), app), true);
  assert.equal(
    isSameOrigin(h({}), app),
    false,
    "a request that names no origin is refused",
  );
  assert.equal(
    isSameOrigin(h({ "sec-fetch-site": "none" }), app),
    true,
    "typed into the address bar",
  );
});

test("rate rules cover the public surfaces and nothing else", () => {
  assert.equal(rateRuleFor("POST", "/api/workspace")?.[0], "workspace");
  assert.equal(rateRuleFor("GET", "/api/workspace"), null);
  assert.equal(rateRuleFor("POST", "/api/p/abc/approve")?.[0], "buyer");
  assert.equal(rateRuleFor("POST", "/api/proofholds/ph_1/evidence")?.[0], "evidence");
  assert.equal(rateRuleFor("GET", "/api/paypal/return")?.[0], "paypal");
  assert.equal(rateRuleFor("GET", "/api/proofholds/ph_1"), null);
});

test("the limiter counts per window and reports the wait", () => {
  let now = 1_000_000;
  const l = new RateLimiter(() => now);
  const rule = { limit: 3, windowMs: 60_000 };
  assert.equal(l.hit("k", rule), 0);
  assert.equal(l.hit("k", rule), 0);
  assert.equal(l.hit("k", rule), 0);
  assert.equal(l.hit("k", rule), 60);
  now += 30_000;
  assert.equal(l.hit("k", rule), 30);
  now += 31_000;
  assert.equal(l.hit("k", rule), 0, "a new window starts");
  assert.equal(l.hit("other", rule), 0, "keys are independent");
});

test("client address prefers the first forwarded hop", () => {
  assert.equal(
    clientAddress(h({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })),
    "203.0.113.9",
  );
  assert.equal(clientAddress(h({})), "local");
});

test("security headers: HSTS only on https, eval only in dev", () => {
  const prod = securityHeaders("https://proofhold.example", false);
  assert.ok(prod["Strict-Transport-Security"]);
  assert.ok(!prod["Content-Security-Policy"]!.includes("unsafe-eval"));
  assert.ok(prod["Content-Security-Policy"]!.includes("frame-ancestors 'none'"));
  const dev = securityHeaders("http://127.0.0.1:3200", true);
  assert.equal(dev["Strict-Transport-Security"], undefined);
  assert.ok(dev["Content-Security-Policy"]!.includes("unsafe-eval"));
});

test("logs redact secrets and mask emails", () => {
  const out = redact({
    authorization: "Bearer abc",
    nested: { api_key: "k", note: "mail bea@personal.example.com now" },
    list: ["x", { cookie: "c" }],
  }) as Record<string, unknown>;
  assert.equal(out.authorization, "[redacted]");
  assert.deepEqual(out.nested, {
    api_key: "[redacted]",
    note: "mail b…@personal.example.com now",
  });
  assert.deepEqual(out.list, ["x", { cookie: "[redacted]" }]);
});
