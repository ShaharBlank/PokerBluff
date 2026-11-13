import type { NextRequest } from "next/server";
import { advanceRoom, applyAction, GameError, roomView } from "@/lib/game";
import { limitRequests, roomCode, updateRoom } from "@/lib/store";
import {
  errorReply,
  identity,
  parseAction,
  readBody,
  reply,
} from "@/lib/server";

export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const code = roomCode((await context.params).code);
    const id = identity(request, code);
    if (!id) throw new GameError("Take a seat at this table first.", 403);
    const action = parseAction(await readBody(request));
    await limitRequests(`act:${code}:${id}`, 60, 60);
    const room = await updateRoom(code, (current) =>
      applyAction(advanceRoom(current), id, action),
    );
    return reply(roomView(room, id));
  } catch (error) {
    return errorReply(error);
  }
}
