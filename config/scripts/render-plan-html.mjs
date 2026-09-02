/* Renders the published plan page from `plan.md` and the phase files.
 *
 * Generated rather than hand-maintained because the previous artifact was hand-written and went
 * stale: it predated four phases and a brand change while still looking authoritative. Building it
 * in CI on every dispatch means the page cannot disagree with the plan it claims to show.
 *
 * The output is a single self-contained file — every style, script and glyph is inline, because
 * GitHub Pages serves only `index.html` from this workflow and a reader may open it offline.
 * `config/scripts/plan-html-publish-guard.mjs` enforces that property. */
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { marked } from 'marked'
import { buildPlanModel, readPlanSources } from './plan-html-data.mjs'

const DEFAULT_PLAN_DIR = 'plans/260730-0117-aio-ide-rebrand-and-integration'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => HTML_ESCAPES[character])
}

/* The plan cross-references documents that stay internal by decision — the decision log, the
 * coupling maps, the research baseline. Publishing those links would give every reader a dead path,
 * and pointing them at the repository would 404 because the files are not tracked. So the reference
 * survives as text that says what it is, and the link does not. */
function neutraliseInternalLinks(html) {
  return html.replace(
    /<a href="(?!https?:\/\/|#|mailto:)([^"]*)"([^>]*)>([\s\S]*?)<\/a>/giu,
    (_match, target, _attributes, text) =>
      `<span class="internal-ref" title="Tài liệu nội bộ, không publish: ${escapeHtml(target)}">${text}</span>`
  )
}

function markdownToHtml(markdown) {
  return markdown ? neutraliseInternalLinks(marked.parse(markdown, { async: false })) : ''
}

function statusKey(status) {
  if (status.startsWith('completed')) {
    return 'completed'
  }
  return status.startsWith('staged') ? 'staged' : 'pending'
}

const STATUS_LABELS = { completed: 'hoàn tất', pending: 'chờ làm', staged: 'chia tranche' }

const STYLES = `
:root {
  --paper: #f5f1e9;
  --paper-deep: #ebe4d8;
  --card: #fffdf8;
  --ink: #16171a;
  --muted: #5f5c55;
  --line: #c3bbad;
  --accent: #a52b31;
  --accent-soft: #f0dcd9;
  --done: #2f6b4f;
  --done-soft: #dcebe2;
  --stage: #6b5330;
  --stage-soft: #f0e4cf;
  --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --sans: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  --mono: "Cascadia Mono", "SF Mono", Consolas, monospace;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
}
.wrap { max-width: 68rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; }
header.masthead { border-bottom: 3px double var(--line); padding-bottom: 1.25rem; margin-bottom: 2rem; }
.eyebrow { font-family: var(--mono); font-size: 0.75rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 0 0 0.5rem; }
h1 { font-family: var(--serif); font-size: clamp(1.75rem, 5vw, 3rem); line-height: 1.1; margin: 0 0 0.75rem; }
.masthead p { margin: 0; color: var(--muted); max-width: 46rem; }
h2 { font-family: var(--serif); font-size: clamp(1.3rem, 3vw, 1.9rem); margin: 2.5rem 0 0.75rem; }
h3 { font-family: var(--serif); font-size: 1.15rem; margin: 1.5rem 0 0.5rem; }
a { color: var(--accent); text-underline-offset: 0.15em; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.75rem; margin: 1.5rem 0 0; padding: 0; list-style: none; }
.stats li { background: var(--card); border: 1px solid var(--line); padding: 0.75rem 0.9rem; }
.stats .figure { display: block; font-family: var(--serif); font-size: 1.9rem; line-height: 1; }
.stats .caption { display: block; font-size: 0.78rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 0.35rem; }
.controls { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin: 1rem 0 1.25rem; }
.controls label { font-size: 0.85rem; color: var(--muted); }
input[type="search"] { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--line); background: var(--card); color: inherit; min-width: 12rem; flex: 1 1 12rem; }
.chip { font: inherit; font-size: 0.82rem; padding: 0.35rem 0.7rem; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; }
.chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.chip:focus-visible, .card:focus-visible, .close:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.9rem; padding: 0; margin: 0; list-style: none; }
.card { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; text-align: left; font: inherit; color: inherit; background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--line); padding: 0.9rem 1rem; cursor: pointer; transition: transform 120ms ease, box-shadow 120ms ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(22, 23, 26, 0.12); }
.card[data-status="completed"] { border-left-color: var(--done); }
.card[data-status="pending"] { border-left-color: var(--accent); }
.card[data-status="staged"] { border-left-color: var(--stage); }
.card .num { font-family: var(--mono); font-size: 0.75rem; color: var(--muted); letter-spacing: 0.1em; }
.card .name { font-family: var(--serif); font-size: 1.08rem; line-height: 1.25; }
.card .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; font-size: 0.78rem; color: var(--muted); margin-top: auto; }
.badge { font-size: 0.72rem; padding: 0.12rem 0.5rem; border: 1px solid var(--line); border-radius: 999px; white-space: nowrap; }
.badge[data-status="completed"] { background: var(--done-soft); border-color: var(--done); color: var(--done); }
.badge[data-status="pending"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.badge[data-status="staged"] { background: var(--stage-soft); border-color: var(--stage); color: var(--stage); }
.bar { display: block; height: 4px; background: var(--paper-deep); border: 0; }
.bar > span { display: block; height: 100%; background: var(--done); }
figure.diagram { margin: 1rem 0 0; background: var(--card); border: 1px solid var(--line); padding: 1rem; overflow-x: auto; }
figure.diagram svg { display: block; width: 100%; height: auto; min-width: 34rem; }
figure.diagram figcaption { font-size: 0.8rem; color: var(--muted); margin-top: 0.6rem; }
.prose { max-width: 46rem; }
.prose table, .modal table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin: 0.75rem 0; }
.prose th, .prose td, .modal th, .modal td { border: 1px solid var(--line); padding: 0.4rem 0.55rem; text-align: left; vertical-align: top; }
.prose th, .modal th { background: var(--paper-deep); }
code { font-family: var(--mono); font-size: 0.88em; background: var(--paper-deep); padding: 0.05em 0.3em; }
pre { background: var(--ink); color: var(--paper); padding: 0.8rem; overflow-x: auto; }
pre code { background: none; color: inherit; }
blockquote { margin: 1rem 0; padding: 0.4rem 0 0.4rem 1rem; border-left: 3px solid var(--accent); color: var(--muted); }
dialog.modal { width: min(52rem, 94vw); max-height: 88vh; padding: 0; border: 1px solid var(--ink); background: var(--card); color: inherit; }
dialog.modal::backdrop { background: rgba(22, 23, 26, 0.55); }
.modal-head { position: sticky; top: 0; display: flex; gap: 1rem; align-items: flex-start; justify-content: space-between; padding: 1rem 1.25rem 0.75rem; background: var(--card); border-bottom: 1px solid var(--line); }
.modal-head h2 { margin: 0.2rem 0 0; font-size: 1.3rem; }
.modal-body { padding: 0.5rem 1.25rem 1.5rem; }
.close { font: inherit; line-height: 1; padding: 0.3rem 0.6rem; border: 1px solid var(--line); background: var(--paper); cursor: pointer; }
.empty { color: var(--muted); font-style: italic; }
.internal-ref { border-bottom: 1px dotted var(--muted); color: var(--muted); cursor: help; }
footer { border-top: 1px solid var(--line); margin-top: 3rem; padding-top: 1rem; font-size: 0.82rem; color: var(--muted); }
@media (max-width: 30rem) {
  .wrap { padding: 1rem 0.75rem 3rem; }
  .grid { grid-template-columns: 1fr; }
  figure.diagram svg { min-width: 26rem; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
  .card:hover { transform: none; }
}
@media print { .controls, .close { display: none; } .card { break-inside: avoid; } }
`

/* Longest-path depth, so an edge always points forward and the diagram cannot draw a phase before
 * something it depends on. Phase 12 lands after 08 for this reason rather than by its file number. */
function dependencyLayers(phases) {
  const byNumber = new Map(phases.map((phase) => [phase.number, phase]))
  const depthOf = new Map()
  const resolve = (number, seen = new Set()) => {
    if (depthOf.has(number)) {
      return depthOf.get(number)
    }
    if (seen.has(number)) {
      return 0
    }
    seen.add(number)
    const phase = byNumber.get(number)
    const parents = (phase?.dependencies ?? []).filter((entry) => byNumber.has(entry))
    const depth =
      parents.length === 0 ? 0 : Math.max(...parents.map((entry) => resolve(entry, seen))) + 1
    depthOf.set(number, depth)
    return depth
  }
  for (const phase of phases) {
    resolve(phase.number)
  }
  const layers = []
  for (const phase of phases) {
    const depth = depthOf.get(phase.number) ?? 0
    ;(layers[depth] ??= []).push(phase)
  }
  return layers.map((layer) => layer.sort((left, right) => left.number - right.number))
}

const NODE = { width: 56, height: 34, gapX: 34, gapY: 30, padding: 16 }

function diagramSvg(phases) {
  const layers = dependencyLayers(phases)
  const columns = Math.max(...layers.map((layer) => layer.length))
  const width = NODE.padding * 2 + columns * NODE.width + (columns - 1) * NODE.gapX
  const height = NODE.padding * 2 + layers.length * NODE.height + (layers.length - 1) * NODE.gapY
  const centre = new Map()
  layers.forEach((layer, row) => {
    const rowWidth = layer.length * NODE.width + (layer.length - 1) * NODE.gapX
    const startX = (width - rowWidth) / 2
    layer.forEach((phase, column) => {
      centre.set(phase.number, {
        x: startX + column * (NODE.width + NODE.gapX) + NODE.width / 2,
        y: NODE.padding + row * (NODE.height + NODE.gapY) + NODE.height / 2,
        phase
      })
    })
  })
  const edges = phases
    .flatMap((phase) =>
      phase.dependencies
        .filter((parent) => centre.has(parent) && centre.has(phase.number))
        .map((parent) => ({ from: centre.get(parent), to: centre.get(phase.number) }))
    )
    .filter(({ from, to }) => from.y < to.y)
    .map(
      ({ from, to }) =>
        `<line x1="${from.x.toFixed(1)}" y1="${(from.y + NODE.height / 2).toFixed(1)}" x2="${to.x.toFixed(1)}" y2="${(to.y - NODE.height / 2 - 5).toFixed(1)}" stroke="var(--line)" stroke-width="1.4" marker-end="url(#arrow)" />`
    )
    .join('')
  const nodes = [...centre.values()]
    .map(({ x, y, phase }) => {
      const key = statusKey(phase.status)
      const left = (x - NODE.width / 2).toFixed(1)
      const top = (y - NODE.height / 2).toFixed(1)
      return (
        `<g><title>Phase ${phase.number}: ${escapeHtml(phase.title)} (${STATUS_LABELS[key]})</title>` +
        `<rect x="${left}" y="${top}" width="${NODE.width}" height="${NODE.height}" rx="4" fill="var(--card)" stroke="var(--${key === 'completed' ? 'done' : key === 'staged' ? 'stage' : 'accent'})" stroke-width="1.6" />` +
        `<text x="${x.toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-family="var(--mono)" font-size="15" fill="var(--ink)">${String(phase.number).padStart(2, '0')}</text></g>`
      )
    })
    .join('')
  return (
    `<svg viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" role="img" aria-labelledby="diagram-title diagram-desc">` +
    `<title id="diagram-title">Đồ thị phụ thuộc giữa các phase</title>` +
    `<desc id="diagram-desc">${layers.length} lớp thực thi; mũi tên đi từ phase phải xong trước tới phase phụ thuộc nó. Bảng phase bên dưới có cùng thông tin dưới dạng văn bản.</desc>` +
    `<defs><marker id="arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--line)" /></marker></defs>` +
    `${edges}${nodes}</svg>`
  )
}

function phaseCard(phase) {
  const key = statusKey(phase.status)
  const done = phase.criteria.filter((entry) => entry.done).length
  const percent = phase.criteria.length === 0 ? 0 : Math.round((done / phase.criteria.length) * 100)
  const deps =
    phase.dependencies.length === 0
      ? 'không phụ thuộc'
      : `sau ${phase.dependencies.map((entry) => String(entry).padStart(2, '0')).join(', ')}`
  const effort = phase.effort ? `<span>${escapeHtml(phase.effort)}</span>` : ''
  return `<li><button type="button" class="card" data-phase="${phase.number}" data-status="${key}" data-title="${escapeHtml(phase.title)}" aria-haspopup="dialog" aria-label="Phase ${phase.number}: ${escapeHtml(phase.title)}">
<span class="num">Phase ${String(phase.number).padStart(2, '0')}</span>
<span class="name">${escapeHtml(phase.title)}</span>
<span class="bar" aria-hidden="true"><span style="display:block;height:100%;width:${percent}%;background:var(--done)"></span></span>
<span class="meta"><span class="badge" data-status="${key}">${STATUS_LABELS[key]}</span><span>${done}/${phase.criteria.length} tiêu chí</span>${effort}<span>${escapeHtml(deps)}</span></span>
</button></li>`
}

function phaseDetail(phase) {
  const criteria = phase.criteria
    .map(
      (entry) =>
        `<li>${entry.done ? '<strong>đã xong</strong> — ' : ''}${markdownToHtml(entry.text).replace(/^<p>|<\/p>\s*$/gu, '')}</li>`
    )
    .join('')
  const sections = phase.sections
    .filter((section) => !/^success criteria/iu.test(section.heading))
    .map((section) => `<h3>${escapeHtml(section.heading)}</h3>${markdownToHtml(section.markdown)}`)
    .join('')
  const criteriaList = criteria ? `<ul>${criteria}</ul>` : '<p class="empty">Chưa có tiêu chí.</p>'
  const met = phase.criteria.filter((entry) => entry.done).length
  return `<h3>Success criteria (${met}/${phase.criteria.length})</h3>${criteriaList}${sections}`
}

function section(id, heading, markdown) {
  if (!markdown) {
    return ''
  }
  return `<section id="${id}"><h2>${escapeHtml(heading)}</h2><div class="prose">${markdownToHtml(markdown)}</div></section>`
}

/* Filtering and the detail dialog.
 *
 * Phase bodies live once in the document, hidden, and the dialog borrows the node rather than
 * holding a second copy in a JSON payload — the earlier draft embedded both and doubled the file for
 * no reader benefit. Hidden-but-present also means a reader without scripting still gets every
 * phase body: the noscript stylesheet reveals them in place. */
const CLIENT_SCRIPT = `
const dialog = document.getElementById('phase-dialog');
const dialogTitle = document.getElementById('phase-dialog-title');
const dialogBody = document.getElementById('phase-dialog-body');
const cards = Array.from(document.querySelectorAll('.card'));
const detailFor = (number) => document.getElementById('phase-detail-' + number);
let opener = null;
let borrowed = null;
let home = null;

function returnBorrowed() {
  if (borrowed && home) home.appendChild(borrowed);
  borrowed = null;
  home = null;
}

function openPhase(number, title) {
  const detail = detailFor(number);
  if (!detail) return;
  returnBorrowed();
  dialogTitle.textContent = 'Phase ' + String(number).padStart(2, '0') + ': ' + title;
  home = detail.parentElement;
  borrowed = detail;
  detail.hidden = false;
  dialogBody.replaceChildren(detail);
  dialogBody.scrollTop = 0;
  opener = document.activeElement;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector('.close').focus();
}

dialog.addEventListener('close', () => {
  if (borrowed) borrowed.hidden = true;
  returnBorrowed();
  if (opener && document.contains(opener)) opener.focus();
});
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
for (const card of cards) {
  card.addEventListener('click', () => openPhase(Number(card.dataset.phase), card.dataset.title));
}

const search = document.getElementById('phase-search');
const chips = Array.from(document.querySelectorAll('.chip'));
const haystacks = new Map(cards.map((card) => {
  const detail = detailFor(Number(card.dataset.phase));
  return [card, (card.textContent + ' ' + (detail ? detail.textContent : '')).toLowerCase()];
}));

function applyFilter() {
  const needle = search.value.trim().toLowerCase();
  const active = chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true').map((chip) => chip.dataset.status);
  let shown = 0;
  for (const card of cards) {
    const visible = (active.length === 0 || active.includes(card.dataset.status)) &&
      (needle === '' || haystacks.get(card).includes(needle));
    card.parentElement.hidden = !visible;
    if (visible) shown += 1;
  }
  document.getElementById('filter-status').textContent = shown + ' / ' + cards.length + ' phase hiển thị';
}
search.addEventListener('input', applyFilter);
for (const chip of chips) {
  chip.addEventListener('click', () => {
    chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    applyFilter();
  });
}
applyFilter();
`

function statCards(stats) {
  const entries = [
    [stats.phaseCount, 'phase'],
    [stats.byStatus.completed ?? 0, 'hoàn tất'],
    [stats.byStatus.pending ?? 0, 'chờ làm'],
    [stats.byStatus.staged ?? 0, 'chia tranche'],
    [`${stats.criteriaDone}/${stats.criteriaTotal}`, 'tiêu chí đạt'],
    [stats.dependencyEdges, 'cạnh phụ thuộc']
  ]
  return entries
    .map(
      ([figure, caption]) =>
        `<li><span class="figure">${escapeHtml(figure)}</span><span class="caption">${escapeHtml(caption)}</span></li>`
    )
    .join('')
}

export function renderPlanHtml(model, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString().slice(0, 10)
  const risks = model.phases
    .filter((phase) => phase.risk)
    .map(
      (phase) =>
        `<h3>Phase ${String(phase.number).padStart(2, '0')} — ${escapeHtml(phase.title)}</h3>${markdownToHtml(phase.risk)}`
    )
    .join('')
  const sourceList = model.sourceLinks
    .map((url) => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`)
    .join('')
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="${escapeHtml(model.title)} — lộ trình theo phase, phụ thuộc, quyết định và tiêu chí nghiệm thu.">
<title>${escapeHtml(model.title)}</title>
<style>${STYLES}</style>
<noscript><style>.phase-detail[hidden] { display: block !important; } .controls { display: none; }</style></noscript>
</head>
<body>
<div class="wrap">
<header class="masthead">
<p class="eyebrow">Roadmap · generate ${escapeHtml(generatedAt)}</p>
<h1>${escapeHtml(model.title)}</h1>
<p>Trang này được sinh từ <code>plan.md</code> và các file <code>phase-*.md</code>, nên nội dung luôn khớp với plan trong repo. Bấm một phase để xem chi tiết.</p>
<ul class="stats">${statCards(model.stats)}</ul>
</header>
<section id="phases">
<h2>Phase</h2>
<figure class="diagram">${diagramSvg(model.phases)}<figcaption>Mũi tên đi từ phase phải hoàn tất trước. Phase 12 nằm sau 08 theo phụ thuộc, không theo số thứ tự file.</figcaption></figure>
<div class="controls">
<label for="phase-search">Tìm phase</label>
<input type="search" id="phase-search" placeholder="rebrand, CI, ACP…" autocomplete="off">
${Object.entries(STATUS_LABELS)
  .map(
    ([key, label]) =>
      `<button type="button" class="chip" data-status="${key}" aria-pressed="false">${escapeHtml(label)}</button>`
  )
  .join('')}
<p id="filter-status" role="status" style="margin:0;font-size:0.82rem;color:var(--muted)"></p>
</div>
<ul class="grid">${model.phases.map(phaseCard).join('')}</ul>
<div id="phase-details">
${model.phases
  .map(
    (phase) =>
      `<article class="phase-detail" id="phase-detail-${phase.number}" hidden><h3>Phase ${String(phase.number).padStart(2, '0')} — ${escapeHtml(phase.title)}</h3>${phaseDetail(phase)}</article>`
  )
  .join('')}
</div>
</section>
${section('muc-tieu', 'Mục tiêu', model.goal)}
${section('baseline', 'Repo baseline', model.baseline)}
${section('quyet-dinh', 'Quyết định đã chốt', model.decisions)}
${section('gate', 'Gate', model.gates)}
${section('nghiem-thu', 'Acceptance criteria cấp chương trình', model.acceptance)}
${risks ? `<section id="rui-ro"><h2>Rủi ro theo phase</h2><div class="prose">${risks}</div></section>` : ''}
${section('cau-hoi', 'Câu hỏi cần quyết định', model.openQuestions)}
${sourceList ? `<section id="nguon"><h2>Nguồn</h2><ul class="prose">${sourceList}</ul></section>` : ''}
<footer><p>Artifact tự chứa: không tải asset ngoài, đọc được offline. Sinh bởi <code>config/scripts/render-plan-html.mjs</code>.</p></footer>
</div>
<dialog class="modal" id="phase-dialog" aria-labelledby="phase-dialog-title">
<div class="modal-head"><h2 id="phase-dialog-title"></h2><button type="button" class="close" aria-label="Đóng">Đóng</button></div>
<div class="modal-body prose" id="phase-dialog-body"></div>
</dialog>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>
`
}

function runCli(argv) {
  const planDir = argv[0] ?? DEFAULT_PLAN_DIR
  const outPath = argv[1] ?? `${planDir}/plan.html`
  const model = buildPlanModel(readPlanSources(planDir))
  writeFileSync(outPath, renderPlanHtml(model), 'utf8')
  console.log(
    `wrote ${outPath}: ${model.stats.phaseCount} phases, ${model.stats.dependencyEdges} dependency edges, ${model.stats.criteriaDone}/${model.stats.criteriaTotal} criteria met`
  )
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runCli(process.argv.slice(2)))
}
