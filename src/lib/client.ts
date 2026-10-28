/** Fetch helper for client components: JSON in, JSON out, errors as messages. */
export async function api<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body || init.form ? "POST" : "GET"),
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.form ?? (init.body ? JSON.stringify(init.body) : undefined),
  });
  let data: { error?: string } & T;
  try {
    data = (await res.json()) as { error?: string } & T;
  } catch {
    throw new Error(res.ok ? "Unexpected response." : `Request failed (${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status}).`);
  return data;
}
