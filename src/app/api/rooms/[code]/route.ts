import type { NextRequest } from "next/server";
import { advanceRoom, roomView } from "@/lib/game";
import { roomCode, updateRoom } from "@/lib/store";
import { errorReply, identity, reply } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const code = roomCode((await context.params).code);
    const room = await updateRoom(code, (current) => advanceRoom(current));
    return reply(roomView(room, identity(request, code)));
  } catch (error) {
    return errorReply(error);
  }
}
