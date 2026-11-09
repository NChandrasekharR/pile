/* Pile — reader page. */

const KEY = "pile.items";
const PAGE = 150;

const $ = (sel) => document.querySelector(sel);
const send = (msg) => chrome.runtime.sendMessage(msg);

let items = [];
let undoStack = [];
let toastTimer = null;

const view = {
  status: "unread",
  q: "",
  sort: "new",
  domains: new Set(),
  limit: PAGE,
  cursor: -1
};

/* ---------- time ---------- */

const DAY = 86400000;

function age(ms) {
  const d = Date.now() - ms;
  if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))}m`;
  if (d < DAY) return `${Math.round(d / 3600000)}h`;
  if (d < 7 * DAY) return `${Math.round(d / DAY)}d`;
  return new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function dayLabel(ms) {
  const then = new Date(ms);
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const opts = { weekday: "short", day: "numeric", month: "short" };
  if (then.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return then.toLocaleDateString(undefined, opts);
}

function rot(ms) {
  const days = (Date.now() - ms) / DAY;
  return Math.min(1, Math.max(0.12, 0.12 + (days / 12) * 0.88)).toFixed(2);
}

/* ---------- selection ---------- */

function matchesStatus(it) {
  if (view.status === "all") return true;
  if (view.status === "unread") return !it.read && !it.archived;
  if (view.status === "starred") return it.starred;
  if (view.status === "archived") return it.archived;
  return true;
}

function visible() {
  const q = view.q.trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  let out = items.filter((it) => {
    if (!matchesStatus(it)) return false;
    if (view.domains.size && !view.domains.has(it.domain)) return false;
    if (!terms.length) return true;
    const hay = `${it.title} ${it.url}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });

  const by = {
    new: (a, b) => b.closedAt - a.closedAt,
    old: (a, b) => a.closedAt - b.closedAt,
    domain: (a, b) => a.domain.localeCompare(b.domain) || b.closedAt - a.closedAt,
    count: (a, b) => b.count - a.count || b.closedAt - a.closedAt,
    title: (a, b) => a.title.localeCompare(b.title)
  };
  out = out.sort(by[view.sort] || by.new);
  return out;
}

/* ---------- mutations ---------- */

async function patch(ids, p) {
  const set = new Set(ids);
  for (const it of items) if (set.has(it.id)) Object.assign(it, p);
  paint();
  await send({ type: "patch", ids, patch: p });
}

async function remove(ids, label) {
  const set = new Set(ids);
  const removed = items.filter((it) => set.has(it.id));
  items = items.filter((it) => !set.has(it.id));
  paint();
  await send({ type: "delete", ids });
  undoStack.push(removed);
  toast(label || `Deleted ${removed.length} ${removed.length === 1 ? "link" : "links"}`);
}

async function undo() {
  const rows = undoStack.pop();
  if (!rows || !rows.length) return;
  items = items.concat(rows).sort((a, b) => b.closedAt - a.closedAt);
  paint();
  await send({ type: "restore", rows });
  hideToast();
}

function openLink(it, { focus = false } = {}) {
  chrome.tabs.create({ url: it.url, active: focus });
  if (!it.read) patch([it.id], { read: true });
}

/* ---------- toast ---------- */

function toast(text) {
  $("#toastText").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 7000);
}

function hideToast() {
  $("#toast").hidden = true;
  clearTimeout(toastTimer);
}

/* ---------- render ---------- */

function favNode(it) {
  const img = document.createElement("img");
  img.className = "fav";
  img.alt = "";
  img.loading = "lazy";
  img.src = chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(it.url)}&size=32`);
  img.addEventListener("error", () => {
    const stub = document.createElement("span");
    stub.className = "fav-stub";
    stub.textContent = (it.domain[0] || "?").toUpperCase();
    img.replaceWith(stub);
  });
  return img;
}

function rowNode(it, index, batchSizes) {
  const row = document.createElement("article");
  row.className = "row";
  row.dataset.id = it.id;
  row.dataset.index = String(index);
  if (it.read) row.classList.add("is-read");

  const gutter = document.createElement("span");
  gutter.className = "age";
  gutter.style.opacity = rot(it.closedAt);
  row.append(gutter, favNode(it));

  const body = document.createElement("div");
  body.className = "title";

  const a = document.createElement("a");
  a.href = it.url;
  a.textContent = it.title;
  a.title = it.url;
  a.target = "_blank";
  a.rel = "noreferrer";
  a.addEventListener("click", (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      if (!it.read) patch([it.id], { read: true });
      return;
    }
    e.preventDefault();
    openLink(it);
  });
  a.addEventListener("auxclick", () => {
    if (!it.read) patch([it.id], { read: true });
  });
  body.append(a);

  const sub = document.createElement("p");
  sub.className = "sub";
  const site = document.createElement("span");
  site.className = "site";
  site.textContent = it.domain;
  sub.append(site);

  if (it.count > 1) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = `closed ${it.count}×`;
    sub.append(c);
  }
  const size = it.batch ? batchSizes.get(it.batch) || 1 : 1;
  if (size > 3) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = `one of ${size} closed together`;
    sub.append(c);
  }
  if (it.starred) {
    const c = document.createElement("span");
    c.className = "chip kept";
    c.textContent = "kept";
    sub.append(c);
  }
  if (it.archived) {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = "done";
    sub.append(c);
  }
  body.append(sub);
  row.append(body);

  const meta = document.createElement("div");
  meta.className = "meta";

  const when = document.createElement("span");
  when.textContent = age(it.closedAt);
  meta.append(when);

  const acts = [
    ["keep", it.starred ? "kept" : "keep", () => patch([it.id], { starred: !it.starred }), it.starred],
    ["done", it.archived ? "undone" : "done", () => patch([it.id], { archived: !it.archived, read: !it.archived }), false],
    ["kill", "delete", () => remove([it.id]), false]
  ];
  for (const [kind, label, fn, on] of acts) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `act${kind === "kill" ? " kill" : ""}${on ? " on" : ""}`;
    b.textContent = label;
    b.addEventListener("click", fn);
    meta.append(b);
  }
  row.append(meta);
  return row;
}

function paint() {
  const rows = visible();
  const list = $("#list");
  const scroll = window.scrollY;

  const batchSizes = new Map();
  for (const it of items) {
    if (it.batch) batchSizes.set(it.batch, (batchSizes.get(it.batch) || 0) + 1);
  }

  list.textContent = "";

  if (!rows.length) {
    list.append(emptyNode());
  } else {
    const frag = document.createDocumentFragment();
    const grouped = view.sort === "new" || view.sort === "old" || view.sort === "domain";
    let last = null;
    const slice = rows.slice(0, view.limit);
    slice.forEach((it, i) => {
      if (grouped) {
        const label = view.sort === "domain" ? it.domain : dayLabel(it.closedAt);
        if (label !== last) {
          const h = document.createElement("p");
          h.className = "daymark";
          h.append(document.createTextNode(label));
          frag.append(h);
          last = label;
        }
      }
      frag.append(rowNode(it, i, batchSizes));
    });

    if (rows.length > view.limit) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "more";
      more.textContent = `Show ${Math.min(PAGE, rows.length - view.limit)} more of ${rows.length}`;
      more.addEventListener("click", () => {
        view.limit += PAGE;
        paint();
      });
      frag.append(more);
    }
    list.append(frag);
  }

  paintRail(rows);
  paintCursor();
  window.scrollTo({ top: scroll });
}

function emptyNode() {
  const box = document.createElement("div");
  box.className = "empty";
  const head = document.createElement("b");
  const body = document.createElement("span");
  if (!items.length) {
    head.textContent = "Nothing captured yet";
    body.textContent =
      "Pile starts recording the moment it's installed. Close a tab and it lands here. To grab what your browser is already holding, hit “Pull from browser” — but do it before you quit, because that list is wiped on restart.";
  } else if (view.q || view.domains.size) {
    head.textContent = "No matches";
    body.textContent = "Nothing in this view fits that search. Clear the filters to see the rest of the pile.";
  } else {
    head.textContent = "Clear";
    body.textContent = "Nothing left in this view. Switch to Everything to see what you've already dealt with.";
  }
  box.append(head, body);
  return box;
}

function paintRail(rows) {
  const unread = items.filter((i) => !i.read && !i.archived).length;
  $("#c-unread").textContent = unread;
  $("#c-starred").textContent = items.filter((i) => i.starred).length;
  $("#c-archived").textContent = items.filter((i) => i.archived).length;
  $("#c-all").textContent = items.length;

  const sites = new Set(items.map((i) => i.domain));
  const oldest = items.reduce((m, i) => Math.min(m, i.closedAt), Date.now());
  $("#tally").textContent = items.length
    ? `${items.length} links · ${sites.size} sites · oldest ${age(oldest)} old · ${unread} unread`
    : "Nothing captured yet";

  const counts = new Map();
  for (const it of items) {
    if (!matchesStatus(it)) continue;
    counts.set(it.domain, (counts.get(it.domain) || 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);

  const host = $("#domainList");
  host.textContent = "";
  for (const [domain, n] of ordered) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `facet${view.domains.has(domain) ? " is-on" : ""}`;
    const s = document.createElement("span");
    s.textContent = domain;
    s.title = domain;
    const c = document.createElement("b");
    c.textContent = n;
    b.append(s, c);
    b.addEventListener("click", () => {
      if (view.domains.has(domain)) view.domains.delete(domain);
      else view.domains.add(domain);
      view.limit = PAGE;
      view.cursor = -1;
      paint();
    });
    host.append(b);
  }
  $("#clearDomains").hidden = view.domains.size === 0;

  const dock = $("#dock");
  dock.hidden = rows.length === 0;
  $("#dockCount").textContent = `${rows.length} shown`;
}

function paintCursor() {
  const rows = [...document.querySelectorAll(".row")];
  rows.forEach((r) => r.classList.remove("is-cursor"));
  if (view.cursor < 0) return;
  const el = rows[Math.min(view.cursor, rows.length - 1)];
  if (el) {
    el.classList.add("is-cursor");
    el.scrollIntoView({ block: "nearest" });
  }
}

/* ---------- triage ---------- */

const triage = { on: false, queue: [], at: 0 };

function startTriage() {
  triage.queue = visible();
  triage.at = 0;
  if (!triage.queue.length) {
    toast("Nothing in this view to triage");
    return;
  }
  triage.on = true;
  $("#triageView").hidden = false;
  drawTriage();
}

function stopTriage() {
  triage.on = false;
  $("#triageView").hidden = true;
  paint();
}

function drawTriage() {
  const it = triage.queue[triage.at];
  if (!it) return stopTriage();
  $("#triageProgress").textContent = `${triage.at + 1} of ${triage.queue.length}`;
  $("#triageDomain").textContent = `${it.domain} · closed ${age(it.closedAt)} ago`;
  $("#triageTitle").textContent = it.title;
  $("#triageUrl").textContent = it.url;
}

function triageStep(action) {
  const it = triage.queue[triage.at];
  if (!it) return stopTriage();
  if (action === "quit") return stopTriage();
  if (action === "open") {
    openLink(it);
    patch([it.id], { read: true, archived: true });
  }
  if (action === "keep") patch([it.id], { starred: true, read: false });
  if (action === "archive") patch([it.id], { archived: true, read: true });
  if (action === "delete") remove([it.id], "Deleted 1 link");
  triage.at += 1;
  if (triage.at >= triage.queue.length) {
    stopTriage();
    toast("Pile triaged");
    return;
  }
  drawTriage();
}

/* ---------- export ---------- */

function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportAs(kind) {
  const rows = visible();
  const stamp = new Date().toISOString().slice(0, 10);
  if (kind === "json") {
    download(`pile-${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");
    return;
  }
  if (kind === "html") {
    const body = rows
      .map((r) => `    <DT><A HREF="${esc(r.url)}" ADD_DATE="${Math.floor(r.closedAt / 1000)}">${esc(r.title)}</A>`)
      .join("\n");
    download(
      `pile-${stamp}.html`,
      `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n  <DT><H3>Pile ${stamp}</H3>\n  <DL><p>\n${body}\n  </DL><p>\n</DL><p>\n`,
      "text/html"
    );
    return;
  }
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.domain)) groups.set(r.domain, []);
    groups.get(r.domain).push(r);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  const md = [`# Pile — ${rows.length} links`, `_Exported ${stamp}_`, ""]
    .concat(
      ordered.map(([domain, list]) =>
        [`## ${domain} (${list.length})`, ""]
          .concat(list.map((r) => `- [${r.title.replace(/[[\]]/g, "")}](${r.url}) — closed ${age(r.closedAt)} ago`))
          .concat("")
          .join("\n")
      )
    )
    .join("\n");
  download(`pile-${stamp}.md`, md, "text/markdown");
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- wiring ---------- */

function wire() {
  $("#q").addEventListener("input", (e) => {
    view.q = e.target.value;
    view.limit = PAGE;
    view.cursor = -1;
    paint();
  });

  $("#sort").addEventListener("change", (e) => {
    view.sort = e.target.value;
    view.limit = PAGE;
    paint();
  });

  $("#stateFacets").addEventListener("click", (e) => {
    const b = e.target.closest("[data-state]");
    if (!b) return;
    view.status = b.dataset.state;
    view.limit = PAGE;
    view.cursor = -1;
    [...$("#stateFacets").querySelectorAll(".facet")].forEach((f) => f.classList.toggle("is-on", f === b));
    paint();
  });

  $("#clearDomains").addEventListener("click", () => {
    view.domains.clear();
    paint();
  });

  $("#triage").addEventListener("click", startTriage);

  $("#import").addEventListener("click", async () => {
    const { added } = await send({ type: "import" });
    const { items: fresh } = await send({ type: "list" });
    items = fresh;
    paint();
    toast(added ? `Pulled ${added} new ${added === 1 ? "link" : "links"} from the browser` : "Nothing new in the browser's list");
  });

  $("#exportBtn").addEventListener("click", () => {
    const pop = $("#exportPop");
    pop.hidden = !pop.hidden;
    $("#exportBtn").setAttribute("aria-expanded", String(!pop.hidden));
  });

  $("#exportPop").addEventListener("click", (e) => {
    const b = e.target.closest("[data-export]");
    if (!b) return;
    exportAs(b.dataset.export);
    $("#exportPop").hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".menu")) $("#exportPop").hidden = true;
  });

  $("#dock").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-bulk]");
    if (!b) return;
    const rows = visible();
    if (b.dataset.bulk === "open") {
      const batch = rows.slice(0, 10);
      batch.forEach((it) => chrome.tabs.create({ url: it.url, active: false }));
      await patch(batch.map((i) => i.id), { read: true });
      toast(`Opened ${batch.length} in the background`);
    }
    if (b.dataset.bulk === "archive") {
      await patch(rows.map((i) => i.id), { archived: true, read: true });
      toast(`Marked ${rows.length} done`);
    }
    if (b.dataset.bulk === "delete") {
      if (!confirm(`Delete ${rows.length} links from Pile? Undo is available for one step.`)) return;
      await remove(rows.map((i) => i.id));
    }
  });

  $("#toastUndo").addEventListener("click", undo);

  $("#triageView").addEventListener("click", (e) => {
    const b = e.target.closest("[data-triage]");
    if (b) triageStep(b.dataset.triage);
  });

  document.addEventListener("keydown", onKey);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[KEY]) return;
    items = changes[KEY].newValue || [];
    if (!triage.on) paint();
  });
}

function onKey(e) {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

  if (triage.on) {
    const map = { Enter: "open", k: "keep", K: "keep", a: "archive", A: "archive", x: "delete", X: "delete", ArrowRight: "skip", Escape: "quit" };
    const act = map[e.key];
    if (act) {
      e.preventDefault();
      if (act === "skip") {
        triage.at = Math.min(triage.at + 1, triage.queue.length - 1);
        drawTriage();
      } else {
        triageStep(act);
      }
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      triage.at = Math.max(0, triage.at - 1);
      drawTriage();
    }
    return;
  }

  if (e.key === "/" && !typing) {
    e.preventDefault();
    $("#q").focus();
    $("#q").select();
    return;
  }
  if (e.key === "Escape" && typing) {
    e.target.blur();
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  const rows = visible().slice(0, view.limit);
  const at = () => rows[view.cursor];

  switch (e.key) {
    case "j":
    case "ArrowDown":
      e.preventDefault();
      view.cursor = Math.min(view.cursor + 1, rows.length - 1);
      paintCursor();
      break;
    case "k":
    case "ArrowUp":
      e.preventDefault();
      view.cursor = Math.max(view.cursor - 1, 0);
      paintCursor();
      break;
    case "o":
    case "Enter":
      if (at()) {
        e.preventDefault();
        openLink(at(), { focus: e.key === "Enter" && e.shiftKey });
      }
      break;
    case "s":
      if (at()) patch([at().id], { starred: !at().starred });
      break;
    case "e":
      if (at()) patch([at().id], { archived: !at().archived, read: true });
      break;
    case "x":
      if (at()) remove([at().id]);
      break;
    case "u":
      undo();
      break;
    case "t":
      startTriage();
      break;
    default:
      break;
  }
}

/* ---------- boot ---------- */

(async function boot() {
  wire();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await send({ type: "list" });
      items = res?.items || [];
      break;
    } catch {
      // service worker still waking up
      await new Promise((r) => setTimeout(r, 180));
    }
  }
  paint();
})();
