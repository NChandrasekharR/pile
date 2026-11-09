/* Pile — roadmap page.
   Renders ROADMAP.md straight from GitHub, so editing that file updates this page.
   GitHub's raw CDN caches for five minutes; there's no build step. */

const SRC = "https://raw.githubusercontent.com/NChandrasekharR/pile/main/ROADMAP.md";
const BLOB = "https://github.com/NChandrasekharR/pile/blob/main/";

/* Sections with their own marker on the rail. Any other heading is "ahead". */
const KINDS = { "today": "today", "not planned": "off", "open question": "ask" };

const root = document.getElementById("roadmap");

/* ---------- inline markdown ---------- */

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function href(url) {
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // javascript:, data: and friends
  return BLOB + url.replace(/^\.?\//, "");
}

function inline(text) {
  // Odd parts are code spans, which stay literal.
  return text.split(/(`[^`]+`)/).map((part, i) => {
    if (i % 2) return `<code>${esc(part.slice(1, -1))}</code>`;
    return esc(part)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
        const h = href(url.replace(/&amp;/g, "&"));
        return h ? `<a href="${esc(h)}">${label}</a>` : label;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
  }).join("");
}

/* ---------- blocks ---------- */

/** Splits the file into intro blocks and one section per `##` heading. */
function parse(md) {
  const doc = { intro: [], sections: [] };
  let blocks = doc.intro;
  let para = null;
  let list = null;

  for (const line of md.replace(/\r\n?/g, "\n").split("\n")) {
    let m;
    if (!line.trim()) { para = list = null; continue; }
    if (/^#\s/.test(line)) { para = list = null; continue; } // the page has its own h1
    if ((m = line.match(/^##\s+(.*)/))) {
      para = list = null;
      const section = { title: m[1].trim(), blocks: [] };
      doc.sections.push(section);
      blocks = section.blocks;
      continue;
    }
    if ((m = line.match(/^###\s+(.*)/))) {
      para = list = null;
      blocks.push({ type: "h3", text: m[1].trim() });
      continue;
    }
    if ((m = line.match(/^\s*[-*]\s+(?:\[([ xX])\]\s+)?(.*)/))) {
      para = null;
      if (!list) blocks.push((list = { type: "ul", items: [] }));
      list.items.push({ task: m[1] !== undefined, done: /x/i.test(m[1] || ""), text: m[2] });
      continue;
    }
    if (list && /^\s+\S/.test(line)) { list.items[list.items.length - 1].text += " " + line.trim(); continue; }
    list = null;
    if (para) para.text += " " + line.trim();
    else blocks.push((para = { type: "p", text: line.trim() }));
  }
  return doc;
}

function renderBlocks(blocks) {
  return blocks.map((b) => {
    if (b.type === "h3") return `<h3>${inline(b.text)}</h3>`;
    if (b.type === "p") return `<p>${inline(b.text)}</p>`;
    const items = b.items.map((it) => {
      if (!it.task) return `<li>${inline(it.text)}</li>`;
      const state = it.done ? "Shipped: " : "Planned: ";
      return `<li class="task${it.done ? " done" : ""}"><span class="vh">${state}</span>${inline(it.text)}</li>`;
    });
    return `<ul>${items.join("")}</ul>`;
  }).join("");
}

function render(doc) {
  const intro = doc.intro.length ? `<div class="road-intro">${renderBlocks(doc.intro)}</div>` : "";
  const rail = doc.sections.map((s) => {
    const kind = KINDS[s.title.toLowerCase()] || "ahead";
    return `<section class="horizon ${kind}"><h2>${inline(s.title)}</h2><div class="body">${renderBlocks(s.blocks)}</div></section>`;
  });
  root.innerHTML = `${intro}<div class="rail">${rail.join("")}</div>`;
}

fetch(SRC, { cache: "no-cache" })
  .then((r) => {
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    return r.text();
  })
  .then((md) => render(parse(md)))
  .catch(() => {
    root.innerHTML = `<p class="road-status">Couldn't load the roadmap from GitHub just now. <a href="${BLOB}ROADMAP.md">Read ROADMAP.md on GitHub</a>.</p>`;
  });
