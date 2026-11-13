import { randomInt } from "node:crypto";
import type { NextRequest } from "next/server";
import { createRoom, GameError } from "@/lib/game";
import { limitRequests, saveNewRoom } from "@/lib/store";
import {
  errorReply,
  ipKey,
  playerId,
  readBody,
  reply,
  session,
} from "@/lib/server";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    await limitRequests(`create:${ipKey(request)}`, 10, 60);
    const token = session(request);
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = Array.from(
        { length: 6 },
        () => alphabet[randomInt(alphabet.length)],
      ).join("");
      if (await saveNewRoom(createRoom(code, playerId(token, code), body.name)))
        return reply({ code }, token, request.nextUrl.protocol === "https:");
    }
    throw new GameError("Couldn’t open a table. Try again.", 503);
  } catch (error) {
    return errorReply(error);
  }
}
