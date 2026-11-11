import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { geminiStructured, toGeminiSchema } from "../../src/lib/ai/gemini";
import { generateStructured, parseStructured } from "../../src/lib/ai/client";
import { config, resetConfig } from "../../src/lib/config";
import { compilerOutputSchema } from "../../src/lib/compiler/schema";
import { examinerOutputSchema } from "../../src/lib/examiner/examine";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const keys = [
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_FALLBACK_MODEL",
    "AI_PROVIDER",
    "EXAMINER_MODE",
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  resetConfig();
  try {
    fn();
  } finally {
    for (const k of keys)
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    resetConfig();
  }
}

function keywords(schema: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(schema)) schema.forEach((s) => keywords(s, found));
  else if (schema && typeof schema === "object")
    for (const [k, v] of Object.entries(schema)) {
      found.add(k);
      keywords(v, found);
    }
  return found;
}

test("provider resolution: one key picks its provider, both prefer Anthropic", () => {
  withEnv({}, () => {
    assert.equal(config().ai.provider, null);
    assert.equal(config().ai.configured, false);
    assert.equal(config().examiner.mode, "off");
  });
  withEnv({ GEMINI_API_KEY: "g-key" }, () => {
    assert.equal(config().ai.provider, "gemini");
    assert.equal(config().ai.model, "gemini-3.8-flash");
    assert.equal(config().examiner.mode, "model");
  });
  withEnv({ ANTHROPIC_API_KEY: "a-key" }, () => {
    assert.equal(config().ai.provider, "anthropic");
    assert.equal(config().ai.model, "claude-sonnet-5-5");
  });
  withEnv({ ANTHROPIC_API_KEY: "a-key", GEMINI_API_KEY: "g-key" }, () => {
    assert.equal(config().ai.provider, "anthropic");
  });
});

test("provider resolution: AI_PROVIDER forces one, and a blank key counts as none", () => {
  withEnv(
    { ANTHROPIC_API_KEY: "a-key", GEMINI_API_KEY: "g-key", AI_PROVIDER: "gemini" },
    () => assert.equal(config().ai.provider, "gemini"),
  );
  withEnv({ ANTHROPIC_API_KEY: "a-key", AI_PROVIDER: "gemini" }, () => {
    assert.equal(config().ai.provider, null);
    assert.equal(config().examiner.mode, "off");
  });
  withEnv({ GEMINI_API_KEY: "  " }, () => assert.equal(config().ai.provider, null));
});

test("EXAMINER_MODE=simulated and off win over a key; the legacy value means auto", () => {
  withEnv({ GEMINI_API_KEY: "g-key", EXAMINER_MODE: "simulated" }, () => {
    assert.equal(config().examiner.mode, "simulated");
    assert.equal(config().ai.provider, "gemini");
  });
  withEnv({ GEMINI_API_KEY: "g-key", EXAMINER_MODE: "off" }, () =>
    assert.equal(config().examiner.mode, "off"),
  );
  withEnv({ GEMINI_API_KEY: "g-key", EXAMINER_MODE: "anthropic" }, () =>
    assert.equal(config().examiner.mode, "model"),
  );
});

test("the Gemini schema keeps only documented keywords and loses no structure", () => {
  for (const schema of [compilerOutputSchema, examinerOutputSchema]) {
    const original = z.toJSONSchema(schema);
    const narrowed = toGeminiSchema(original);
    const found = keywords(narrowed);
    for (const banned of ["$schema", "oneOf", "const"])
      assert.equal(found.has(banned), false, `${banned} must not reach Gemini`);
    const text = JSON.stringify(narrowed);
    assert.equal(text.includes(String(Number.MAX_SAFE_INTEGER)), false);
    // Same properties and required lists as the source schema.
    const props = (s: unknown) =>
      [...JSON.stringify(s).matchAll(/"required":\[[^\]]*\]/g)].map((m) => m[0]);
    assert.deepEqual(props(narrowed), props(original));
  }
  assert.deepEqual(toGeminiSchema({ type: "string", const: "count" }), {
    type: "string",
    enum: ["count"],
  });
  // A property that happens to be named like a keyword is kept as a property.
  assert.deepEqual(
    toGeminiSchema({ type: "object", properties: { const: { type: "string" } } }),
    { type: "object", properties: { const: { type: "string" } } },
  );
});

const okBody = (text: string) => ({
  id: "v1_x",
  status: "completed",
  steps: [
    { type: "thought", signature: "abc" },
    { type: "model_output", content: [{ type: "text", text }] },
  ],
  usage: { total_input_tokens: 11, total_output_tokens: 7 },
});

test("geminiStructured sends the documented request and reads the reply", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(okBody('{"ok":true}')), { status: 200 });
  }) as typeof fetch;

  const reply = await geminiStructured({
    apiKey: "g-key",
    model: "gemini-3.8-flash",
    system: "You are the examiner.",
    parts: [
      { type: "text", text: "Judge this." },
      { type: "image", mime: "image/png", base64: "AAAA" },
    ],
    jsonSchema: z.toJSONSchema(z.object({ ok: z.boolean() })),
    maxTokens: 8000,
    fetchImpl,
  });

  assert.deepEqual(reply, {
    text: '{"ok":true}',
    status: "completed",
    usage: { inputTokens: 11, outputTokens: 7 },
  });
  assert.equal(calls.length, 1);
  const call = calls[0]!;
  assert.equal(call.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers["x-goog-api-key"], "g-key");
  assert.equal(headers["Api-Revision"], "2026-05-20");
  assert.equal(call.url.includes("g-key"), false, "the key never goes in the URL");
  const body = JSON.parse(String(call.init.body));
  assert.equal(body.model, "gemini-3.8-flash");
  assert.equal(body.system_instruction, "You are the examiner.");
  assert.equal(body.store, false);
  assert.deepEqual(body.input, [
    { type: "text", text: "Judge this." },
    { type: "image", data: "AAAA", mime_type: "image/png" },
  ]);
  assert.equal(body.response_format.type, "text");
  assert.equal(body.response_format.mime_type, "application/json");
  assert.equal(body.response_format.schema.type, "object");
  assert.equal(body.generation_config.max_output_tokens, 8000);
});

test("geminiStructured retries a 429 and gives up on a 400 with the server's message", async () => {
  let n = 0;
  const flaky = (async () => {
    n++;
    return n === 1
      ? new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 })
      : new Response(JSON.stringify(okBody("{}")), { status: 200 });
  }) as typeof fetch;
  const base = {
    apiKey: "g-key",
    model: "m",
    system: "s",
    parts: [{ type: "text" as const, text: "t" }],
    jsonSchema: {},
    maxTokens: 100,
    retryDelaysMs: [0, 0],
  };
  const reply = await geminiStructured({ ...base, fetchImpl: flaky });
  assert.equal(reply.text, "{}");
  assert.equal(n, 2);

  let calls = 0;
  const bad = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
      status: 400,
    });
  }) as typeof fetch;
  await assert.rejects(
    geminiStructured({ ...base, fetchImpl: bad }),
    /Gemini request failed \(400: API key not valid\)/,
  );
  assert.equal(calls, 1, "a client error is not retried");
});

test("geminiStructured returns no text when the model produced none", async () => {
  const empty = (async () =>
    new Response(JSON.stringify({ status: "failed", steps: [] }), {
      status: 200,
    })) as typeof fetch;
  const reply = await geminiStructured({
    apiKey: "k",
    model: "m",
    system: "s",
    parts: [{ type: "text", text: "t" }],
    jsonSchema: {},
    maxTokens: 100,
    fetchImpl: empty,
  });
  assert.equal(reply.text, null);
  assert.equal(reply.status, "failed");
});

test("parseStructured accepts only JSON that fits the schema", () => {
  const schema = z.object({ verdict: z.enum(["pass", "fail", "abstain"]) });
  assert.deepEqual(parseStructured('{"verdict":"abstain"}', schema), {
    verdict: "abstain",
  });
  assert.equal(parseStructured('{"verdict":"maybe"}', schema), null);
  assert.equal(parseStructured("not json", schema), null);
  assert.equal(parseStructured(null, schema), null);
});

test("an overloaded Gemini model falls back once and the result names the model that answered", async () => {
  const saved = {
    key: process.env.GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallback: process.env.GEMINI_FALLBACK_MODEL,
    provider: process.env.AI_PROVIDER,
  };
  const realFetch = globalThis.fetch;
  const asked: string[] = [];
  process.env.GEMINI_API_KEY = "g-key";
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
  process.env.GEMINI_MODEL = "primary-model";
  process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
  resetConfig();
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const name = JSON.parse(String(init?.body)).model as string;
    asked.push(name);
    return name === "primary-model"
      ? new Response(JSON.stringify({ error: { message: "high demand" } }), {
          status: 503,
        })
      : new Response(JSON.stringify(okBody('{"ok":true}')), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await generateStructured({
      system: "s",
      parts: [{ type: "text", text: "t" }],
      schema: z.object({ ok: z.boolean() }),
    });
    assert.deepEqual(result.output, { ok: true });
    assert.equal(result.model, "fallback-model");
    assert.equal(result.provider, "gemini");
    assert.deepEqual(asked, ["primary-model", "primary-model", "fallback-model"]);

    // A rejected key is not an outage: no fallback, the error surfaces.
    asked.length = 0;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      asked.push(JSON.parse(String(init?.body)).model as string);
      return new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
        status: 400,
      });
    }) as typeof fetch;
    await assert.rejects(
      generateStructured({
        system: "s",
        parts: [{ type: "text", text: "t" }],
        schema: z.object({ ok: z.boolean() }),
      }),
      /API key not valid/,
    );
    assert.deepEqual(asked, ["primary-model"]);
  } finally {
    globalThis.fetch = realFetch;
    const restore = (k: string, v: string | undefined) =>
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    restore("GEMINI_API_KEY", saved.key);
    restore("ANTHROPIC_API_KEY", saved.anthropic);
    restore("GEMINI_MODEL", saved.model);
    restore("GEMINI_FALLBACK_MODEL", saved.fallback);
    restore("AI_PROVIDER", saved.provider);
    resetConfig();
  }
});
