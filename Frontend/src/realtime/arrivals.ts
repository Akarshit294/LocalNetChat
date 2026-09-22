import type { ChatUser } from '../lib/messages.ts';

// How long someone counts as "just arrived". The ping itself is a fixed number
// of rings and stops on its own; this only keeps the map from growing.
const RECENT_MS = 12_000;

// Everyone in the first users list was already here, so nobody pings on the way
// in. After that, an id we haven't seen before is someone who just walked in.
//
// `seen` is a ref, mutated here on purpose: the whole point is to remember
// across messages without causing a render.
export function noteArrivals(seen: Set<string>, users: ChatUser[]) {
  const firstList = seen.size === 0;
  const now = Date.now();
  const fresh: Record<string, number> = {};

  for (const user of users) {
    if (!seen.has(user.id)) {
      seen.add(user.id);
      if (!firstList) {
        fresh[user.id] = now;
      }
    }
  }

  return (before: Record<string, number>) => {
    const kept: Record<string, number> = {};
    for (const [id, at] of Object.entries(before)) {
      if (now - at < RECENT_MS) {
        kept[id] = at;
      }
    }
    const unchanged =
      Object.keys(fresh).length === 0 && Object.keys(kept).length === Object.keys(before).length;
    return unchanged ? before : { ...kept, ...fresh };
  };
}
