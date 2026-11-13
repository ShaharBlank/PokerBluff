import { Redis } from "@upstash/redis";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { GameError } from "./game";
import type { Room } from "./game";

const TTL = 24 * 60 * 60;
const folder = join(process.cwd(), ".local-data");
const localState = globalThis as unknown as {
  bluffWrites?: Promise<unknown>;
  bluffLimits?: Map<string, { count: number; reset: number }>;
};
let redis: Redis | undefined;

function database(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return (redis ??= new Redis({ url, token }));
  if (process.env.NODE_ENV === "production" || process.env.VERCEL)
    throw new GameError(
      "This table isn’t set up yet. Add the Upstash Redis environment variables in Vercel, then redeploy.",
      503,
    );
  return null;
}

export function roomCode(value: string): string {
  const code = value.toUpperCase();
  if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code))
    throw new GameError("Enter a valid six-character table code.", 400);
  return code;
}

function filename(code: string) {
  return join(folder, `${roomCode(code)}.json`);
}
function serialWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = (localState.bluffWrites ?? Promise.resolve()).then(operation);
  localState.bluffWrites = result.catch(() => undefined);
  return result;
}

async function readLocal(code: string): Promise<Room | null> {
  try {
    return JSON.parse(await readFile(filename(code), "utf8")) as Room;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function loadRoom(code: string): Promise<Room> {
  roomCode(code);
  const db = database();
  let room: Room | null = null;
  if (db) room = await db.get<Room>(`bluff:room:${code}`);
  else room = await serialWrite(() => readLocal(code));
  if (!room || room.updatedAt < Date.now() - TTL * 1000)
    throw new GameError(
      "That table has closed or the code is incorrect. Create a fresh one.",
      404,
    );
  return room;
}

export async function saveNewRoom(room: Room): Promise<boolean> {
  const db = database();
  if (db)
    return (
      (await db.set(`bluff:room:${room.code}`, room, { nx: true, ex: TTL })) ===
      "OK"
    );
  return serialWrite(async () => {
    await mkdir(folder, { recursive: true });
    try {
      await writeFile(filename(room.code), JSON.stringify(room), {
        flag: "wx",
      });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
    }
  });
}

async function compareAndSave(
  room: Room,
  previousVersion: number,
): Promise<boolean> {
  const db = database();
  if (db)
    return (
      (await db.eval(
        `
    local current = redis.call('GET', KEYS[1])
    if not current then return 0 end
    if cjson.decode(current).version ~= tonumber(ARGV[1]) then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
    return 1
  `,
        [`bluff:room:${room.code}`],
        [previousVersion, JSON.stringify(room), TTL],
      )) === 1
    );
  // Development uses one Next.js process; production always uses Redis's atomic comparison.
  return serialWrite(async () => {
    // Serialize readers too: an open read handle can block replacement on Windows.
    const current = await readLocal(room.code);
    if (!current || current.version !== previousVersion) return false;
    const temp = join(folder, `${room.code}-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(room));
    await rename(temp, filename(room.code));
    return true;
  });
}

export async function updateRoom(
  code: string,
  operation: (room: Room) => Room,
): Promise<Room> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const previous = await loadRoom(code);
    const next = operation(previous);
    if (next === previous) return previous;
    if (await compareAndSave(next, previous.version)) return next;
  }
  throw new GameError("The table is busy. Try once more.", 409);
}

export async function limitRequests(key: string, max: number, seconds: number) {
  const db = database();
  let count: number;
  if (db)
    count = Number(
      await db.eval(
        `
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
  `,
        [`bluff:limit:${key}`],
        [seconds],
      ),
    );
  else {
    const limits = (localState.bluffLimits ??= new Map());
    const now = Date.now();
    for (const [name, value] of limits)
      if (value.reset < now) limits.delete(name);
    const entry = limits.get(key) ?? { count: 0, reset: now + seconds * 1000 };
    entry.count++;
    limits.set(key, entry);
    count = entry.count;
  }
  if (count > max)
    throw new GameError(
      "A little too fast. Give the table a moment, then try again.",
      429,
    );
}
