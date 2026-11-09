/* Pile — storage layer.
   All writes funnel through the service worker so they stay serialised.
   One key holds the whole list; a few thousand rows is well inside quota. */

const KEY = "pile.items";

const IGNORED_SCHEMES =
  /^(chrome|chrome-extension|moz-extension|edge|brave|arc|vivaldi|opera|about|devtools|view-source|chrome-search|chrome-native|data|blob):/i;

const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid",
  "ref_src", "ref_url", "igshid", "_hsenc", "_hsmi", "vero_id", "s_kwcid"
];

/* ---------- url handling ---------- */

export function cleanUrl(raw) {
  if (!raw) return null;
  if (IGNORED_SCHEMES.test(raw)) return null;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
  u.hash = u.hash === "#" ? "" : u.hash;
  let out = u.toString();
  if (u.pathname === "/" && !u.search && !u.hash) out = out.replace(/\/$/, "");
  return out;
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "—";
  }
}

/* ---------- read / write ---------- */

export async function readAll() {
  const bag = await chrome.storage.local.get(KEY);
  return Array.isArray(bag[KEY]) ? bag[KEY] : [];
}

async function writeAll(items) {
  await chrome.storage.local.set({ [KEY]: items });
}

let chain = Promise.resolve();
/** Serialise every mutation so a 50-tab window close can't drop rows. */
export function mutate(fn) {
  const next = chain.then(async () => {
    const items = await readAll();
    const result = await fn(items);
    if (result !== false) await writeAll(items);
    return result;
  });
  chain = next.catch(() => {});
  return next;
}

/* ---------- shaping ---------- */

let seq = 0;
function makeId() {
  seq = (seq + 1) % 100000;
  return `${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function shape(tabish, closedAt, batch, batchSize) {
  const url = cleanUrl(tabish.url);
  if (!url) return null;
  const title = (tabish.title || "").trim() || domainOf(url);
  return {
    id: makeId(),
    url,
    title,
    domain: domainOf(url),
    closedAt: closedAt || Date.now(),
    addedAt: Date.now(),
    count: 1,
    read: false,
    starred: false,
    archived: false,
    batch: batch || null,
    batchSize: batchSize || 1
  };
}

/* ---------- operations ---------- */

/** Adds rows, folding duplicates into the existing entry. Returns rows added. */
export function addItems(incoming) {
  return mutate((items) => {
    const byUrl = new Map(items.map((it) => [it.url, it]));
    let added = 0;
    for (const raw of incoming) {
      if (!raw) continue;
      const hit = byUrl.get(raw.url);
      if (hit) {
        hit.count += 1;
        if (raw.closedAt > hit.closedAt) hit.closedAt = raw.closedAt;
        if (raw.title && hit.title === hit.domain) hit.title = raw.title;
        if (hit.archived) {
          hit.archived = false;
          hit.read = false;
        }
        continue;
      }
      items.push(raw);
      byUrl.set(raw.url, raw);
      added += 1;
    }
    items.sort((a, b) => b.closedAt - a.closedAt);
    return added;
  });
}

export function patchItems(ids, patch) {
  const set = new Set(ids);
  return mutate((items) => {
    let n = 0;
    for (const it of items) {
      if (!set.has(it.id)) continue;
      Object.assign(it, patch);
      n += 1;
    }
    return n;
  });
}

export function deleteItems(ids) {
  const set = new Set(ids);
  return mutate((items) => {
    const removed = items.filter((it) => set.has(it.id));
    for (let i = items.length - 1; i >= 0; i -= 1) {
      if (set.has(items[i].id)) items.splice(i, 1);
    }
    return removed;
  });
}

export function restoreItems(rows) {
  return mutate((items) => {
    const known = new Set(items.map((it) => it.id));
    for (const r of rows) if (!known.has(r.id)) items.push(r);
    items.sort((a, b) => b.closedAt - a.closedAt);
    return rows.length;
  });
}
