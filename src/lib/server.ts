import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GameError } from "./game";
import type { Action } from "./game";
import { validCombination } from "./rules";

const SESSION = "bluff_session";
export function session(request: NextRequest): string {
  const token = request.cookies.get(SESSION)?.value;
  return token && /^[a-f0-9]{64}$/.test(token)
    ? token
    : randomBytes(32).toString("hex");
}
export function playerId(token: string, code: string): string {
  return createHash("sha256")
    .update(`${token}:${code}`)
    .digest("hex")
    .slice(0, 24);
}
export function identity(request: NextRequest, code: string): string | null {
  const token = request.cookies.get(SESSION)?.value;
  return token && /^[a-f0-9]{64}$/.test(token) ? playerId(token, code) : null;
}
export function reply(data: unknown, token?: string, secure = false) {
  const response = NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  if (token)
    response.cookies.set(SESSION, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  return response;
}
export function errorReply(error: unknown) {
  if (error instanceof GameError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  console.error(
    "Table request failed:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json(
    { error: "We couldn’t reach the table. Please try again shortly." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
export async function readBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  let sameHost = !origin;
  try {
    if (origin) sameHost = new URL(origin).host === request.headers.get("host");
  } catch {
    sameHost = false;
  }
  if (request.headers.get("sec-fetch-site") === "cross-site" || !sameHost)
    throw new GameError("Open the table directly to play.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new GameError("Send a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError("The request is empty.");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 4096) {
      await reader.cancel();
      throw new GameError("That request is too large.", 413);
    }
    chunks.push(value);
  }
  let data: unknown;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GameError("That request couldn’t be read.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new GameError("That request couldn’t be read.");
  return data as Record<string, unknown>;
}
export function parseAction(body: Record<string, unknown>): Action {
  if (
    body.type === "ready" ||
    body.type === "continue" ||
    body.type === "rematch" ||
    body.type === "leave"
  )
    return { type: body.type };
  if (
    body.type === "bid" &&
    validCombination(body.combination) &&
    (body.expectedBidId === null || typeof body.expectedBidId === "string") &&
    Number.isInteger(body.round)
  )
    return {
      type: "bid",
      combination: body.combination,
      expectedBidId: body.expectedBidId,
      round: body.round as number,
    };
  if (
    body.type === "challenge" &&
    (body.challenge === "bluff" || body.challenge === "high-card") &&
    typeof body.bidId === "string" &&
    Number.isInteger(body.round)
  )
    return {
      type: "challenge",
      challenge: body.challenge,
      bidId: body.bidId,
      round: body.round as number,
    };
  throw new GameError("Choose a valid action.");
}
export function ipKey(request: NextRequest) {
  return createHash("sha256")
    .update(
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local",
    )
    .digest("hex")
    .slice(0, 24);
}
