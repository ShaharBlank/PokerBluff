import type { NextRequest } from "next/server";
import { joinRoom } from "@/lib/game";
import { limitRequests, roomCode, updateRoom } from "@/lib/store";
import {
  errorReply,
  ipKey,
  playerId,
  readBody,
  reply,
  session,
} from "@/lib/server";

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const body = await readBody(request);
    const code = roomCode((await context.params).code);
    await limitRequests(`join:${ipKey(request)}`, 30, 60);
    const token = session(request);
    await updateRoom(code, (current) =>
      joinRoom(current, playerId(token, code), body.name),
    );
    return reply({ code }, token, request.nextUrl.protocol === "https:");
  } catch (error) {
    return errorReply(error);
  }
}
