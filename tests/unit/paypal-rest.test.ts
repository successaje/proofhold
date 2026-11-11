import { test } from "node:test";
import assert from "node:assert/strict";
import { PayPalRestClient } from "../../src/lib/paypal/rest";
import { PayPalError } from "../../src/lib/paypal/client";

type Call = { url: string; method: string; requestId: string | undefined };

/** A fetch that serves a token, then the given responses for everything else. */
function scripted(responses: (() => Response)[]) {
  const calls: Call[] = [];
  let n = 0;
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/v1/oauth2/token"))
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), {
        status: 200,
      });
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      url: u,
      method: init?.method ?? "GET",
      requestId: headers["PayPal-Request-Id"],
    });
    const next = responses[Math.min(n, responses.length - 1)]!;
    n++;
    return next();
  }) as typeof fetch;
  return { impl, calls };
}

const order = (status: string) =>
  new Response(JSON.stringify({ id: "ORDER1", status, intent: "AUTHORIZE" }), {
    status: 200,
  });
const down = (status = 503) => new Response("\n", { status });

test("a read is retried through a transient 503", async () => {
  const { impl, calls } = scripted([() => down(), () => order("APPROVED")]);
  const client = new PayPalRestClient("id", "secret", "https://pp.test", impl, [0, 0]);
  const got = await client.getOrder("ORDER1");
  assert.equal(got.status, "APPROVED");
  assert.equal(calls.length, 2);
});

test("a write is retried with the same PayPal-Request-Id, so PayPal cannot act twice", async () => {
  const capture = () =>
    new Response(
      JSON.stringify({
        id: "CAP1",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "10.00" },
      }),
      { status: 201 },
    );
  const { impl, calls } = scripted([() => down(502), () => down(504), capture]);
  const client = new PayPalRestClient("id", "secret", "https://pp.test", impl, [0, 0]);
  const got = await client.capture("AUTH1", {
    amountCents: 1000,
    currency: "USD",
    finalCapture: false,
  });
  assert.equal(got.captureId, "CAP1");
  assert.equal(calls.length, 3);
  assert.ok(calls[0]!.requestId, "the write carries an idempotency key");
  assert.equal(new Set(calls.map((c) => c.requestId)).size, 1);
});

test("retries stop, and a real error is not retried at all", async () => {
  const always = scripted([() => down()]);
  const a = new PayPalRestClient("id", "secret", "https://pp.test", always.impl, [0, 0]);
  await assert.rejects(a.getOrder("ORDER1"), (e: unknown) => {
    assert.ok(e instanceof PayPalError);
    assert.equal(e.status, 503);
    return true;
  });
  assert.equal(always.calls.length, 3, "one attempt and two retries");

  const notFound = scripted([
    () =>
      new Response(
        JSON.stringify({ name: "RESOURCE_NOT_FOUND", message: "No such order" }),
        {
          status: 404,
        },
      ),
  ]);
  const b = new PayPalRestClient(
    "id",
    "secret",
    "https://pp.test",
    notFound.impl,
    [0, 0],
  );
  await assert.rejects(b.getOrder("NOPE"), /No such order/);
  assert.equal(notFound.calls.length, 1);
});

test("a dropped connection is retried, then reported as unreachable", async () => {
  let n = 0;
  const impl = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/v1/oauth2/token"))
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), {
        status: 200,
      });
    n++;
    if (n === 1) throw new TypeError("fetch failed");
    return order("CREATED");
  }) as typeof fetch;
  const client = new PayPalRestClient("id", "secret", "https://pp.test", impl, [0, 0]);
  assert.equal((await client.getOrder("ORDER1")).status, "CREATED");

  const dead = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/v1/oauth2/token"))
      return new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), {
        status: 200,
      });
    throw new TypeError("fetch failed");
  }) as typeof fetch;
  const c = new PayPalRestClient("id", "secret", "https://pp.test", dead, [0, 0]);
  await assert.rejects(c.getOrder("ORDER1"), /could not be reached/);
});
