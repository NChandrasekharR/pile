/* Pile — capture engine.

   tabs.onRemoved only hands you a tab id, so we keep a live mirror of open
   tabs in session storage and read the metadata back out at close time. */

import {
  readAll, addItems, patchItems, deleteItems, restoreItems, shape, cleanUrl
} from "./lib/store.js";

const CACHE = "pile.tabcache";
const BATCH = "pile.batch";
const BATCH_WINDOW_MS = 2500;
const READER = chrome.runtime.getURL("reader.html");

/* ---------- open-tab mirror ---------- */

const slim = (t) => ({ url: t.url || t.pendingUrl || "", title: t.title || "" });

async function getCache() {
  const bag = await chrome.storage.session.get(CACHE);
  return bag[CACHE] || {};
}

async function rebuildCache() {
  const tabs = await chrome.tabs.query({});
  const cache = {};
  for (const t of tabs) cache[t.id] = slim(t);
  await chrome.storage.session.set({ [CACHE]: cache });
  return cache;
}

async function remember(tab) {
  if (!tab || tab.id == null) return;
  const cache = await getCache();
  cache[tab.id] = slim(tab);
  await chrome.storage.session.set({ [CACHE]: cache });
}

/* ---------- batching ---------- */

async function batchIdFor(windowId, at) {
  const bag = await chrome.storage.session.get(BATCH);
  const prev = bag[BATCH];
  let batch = prev;
  if (!prev || prev.windowId !== windowId || at - prev.at > BATCH_WINDOW_MS) {
    batch = { id: `b${at.toString(36)}${Math.random().toString(36).slice(2, 5)}`, windowId, at };
  } else {
    batch = { ...prev, at };
  }
  await chrome.storage.session.set({ [BATCH]: batch });
  return batch.id;
}

/* ---------- capture ---------- */

chrome.tabs.onCreated.addListener((tab) => void remember(tab));

chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url || change.title || change.status === "complete") void remember(tab);
});

chrome.tabs.onReplaced.addListener(async (addedId) => {
  try {
    await remember(await chrome.tabs.get(addedId));
  } catch { /* tab vanished */ }
});

chrome.tabs.onRemoved.addListener(async (tabId, info) => {
  const at = Date.now();
  let cache = await getCache();
  let known = cache[tabId];
  if (!known) {
    cache = await rebuildCache();
    known = cache[tabId];
  }
  if (known) {
    delete cache[tabId];
    await chrome.storage.session.set({ [CACHE]: cache });
  }
  if (!known || !cleanUrl(known.url)) return;
  if (known.url.startsWith(READER)) return;

  const batch = await batchIdFor(info.windowId, at);
  await addItems([shape(known, at, batch, 1)]);
  await paintBadge();
});

/* ---------- one-time slurp of the browser's own Recently Closed ---------- */

async function importFromBrowser() {
  let sessions = [];
  try {
    sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 25 });
  } catch {
    return 0;
  }
  const rows = [];
  for (const s of sessions) {
    const at = (s.lastModified || Math.floor(Date.now() / 1000)) * 1000;
    if (s.tab) {
      rows.push(shape(s.tab, at, null, 1));
    } else if (s.window && Array.isArray(s.window.tabs)) {
      const id = `s${at.toString(36)}`;
      for (const t of s.window.tabs) rows.push(shape(t, at, id, s.window.tabs.length));
    }
  }
  const added = await addItems(rows.filter(Boolean));
  await paintBadge();
  return added;
}

/* ---------- badge ---------- */

async function paintBadge() {
  const items = await readAll();
  const unread = items.filter((i) => !i.read && !i.archived).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#0E6B57" });
  await chrome.action.setBadgeText({ text: unread ? (unread > 999 ? "999+" : String(unread)) : "" });
}

/* ---------- opening the reader ---------- */

async function openReader() {
  const [existing] = await chrome.tabs.query({ url: `${READER}*` });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url: READER, pinned: true, index: 0 });
}

chrome.action.onClicked.addListener(() => void openReader());
chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "open-pile") void openReader();
});

/* ---------- lifecycle ---------- */

chrome.runtime.onStartup.addListener(async () => {
  await rebuildCache();
  // A browser quit closes tabs without firing onRemoved, so sweep up whatever
  // the browser still remembers from the last session.
  await importFromBrowser();
  await paintBadge();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await rebuildCache();
  if (details.reason === "install") {
    await importFromBrowser();
    await openReader();
  }
  await paintBadge();
});

/* ---------- reader <-> worker ---------- */

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    switch (msg?.type) {
      case "list":
        respond({ items: await readAll() });
        break;
      case "patch":
        await patchItems(msg.ids, msg.patch);
        await paintBadge();
        respond({ ok: true });
        break;
      case "delete": {
        const removed = await deleteItems(msg.ids);
        await paintBadge();
        respond({ removed });
        break;
      }
      case "restore":
        await restoreItems(msg.rows);
        await paintBadge();
        respond({ ok: true });
        break;
      case "import":
        respond({ added: await importFromBrowser() });
        break;
      default:
        respond({ error: "unknown message" });
    }
  })();
  return true;
});
