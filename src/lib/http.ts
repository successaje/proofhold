/**
 * Route-handler helpers: JSON responses, typed errors, and the two
 * authorisation shapes (seller workspace, buyer token).
 */
import { ZodError } from "zod";
import type { Proofhold } from "./domain/proofhold";
import { ProofholdError } from "./proofholds/lifecycle";
import { InvalidTransition } from "./domain/proofhold";
import { PayPalError } from "./paypal/client";
import { db } from "./store/sql";
import { getProofhold, getProofholdByToken } from "./store/repos";
import { currentWorkspace } from "./session/workspace";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "error",
  ) {
    super(message);
  }
}

export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError || error instanceof ProofholdError)
    return json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof InvalidTransition)
    return json({ error: error.message, code: "invalid_transition" }, { status: 409 });
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
          .join("; "),
        code: "validation",
        issues: error.issues,
      },
      { status: 400 },
    );
  if (error instanceof PayPalError)
    return json(
      { error: error.message, code: "paypal", detail: error.name_ },
      { status: 502 },
    );
  console.error(error);
  return json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
}

/** Wrap a handler so thrown errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError("Expected a JSON body.", 400, "bad_json");
  }
}

/** The seller must own the proofhold. */
export async function sellerProofhold(id: string): Promise<Proofhold> {
  const ws = await currentWorkspace();
  if (!ws)
    throw new HttpError("Sign in to your workspace first.", 401, "unauthenticated");
  const ph = await getProofhold(await db(), id);
  if (!ph || ph.workspaceId !== ws.id)
    throw new HttpError("Proofhold not found.", 404, "not_found");
  return ph;
}

/** The buyer must hold the capability token. */
export async function buyerProofhold(token: string): Promise<Proofhold> {
  const ph = await getProofholdByToken(await db(), token);
  if (!ph) throw new HttpError("This link is not valid.", 404, "not_found");
  return ph;
}
