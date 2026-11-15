// SVG diagrams for scripts/dashboard.mjs: the product flow, the screen map and the system map.
//
// Layout is a grid: a node sits at [col, row] (fractions allowed) and spans columns. Edges are
// orthogonal: `via` points are in grid units (x = col boundary 2.0 is the gap between columns 1
// and 2; y = 0.5 is the middle of row 0), and the first and last segments snap to the node
// borders. Colors come from page classes (the tokens), so the SVG has no <style> of its own.

const FONT = 11.5;
// Average glyph width as a share of the font size: DM Sans regular / bold, and the mono face.
const W = { regular: 0.5, bold: 0.57, mono: 0.6 };
const charW = (fs, kind = 'regular') => fs * W[kind];
const textWidth = (s, fs = FONT, kind = 'bold') => s.length * charW(fs, kind);

const escXml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Fit a label into `maxPx` at font size `fs`, with an ellipsis. */
function fit(s, maxPx, fs, kind = 'regular') {
  const max = Math.max(3, Math.floor(maxPx / charW(fs, kind)));
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Grid geometry: column pitch `colW`, per-row heights; gaps are inside the pitch. */
function makeGrid({ cols, colW, colGap, rowHs, rowGap, padX = 16, padY = 12, padRight = padX }) {
  const rowTop = [];
  let acc = padY;
  for (const h of rowHs) {
    rowTop.push(acc);
    acc += h;
  }
  const X = (v) => padX + v * colW;
  const Y = (v) => {
    const i = Math.min(Math.floor(v), rowHs.length - 1);
    return rowTop[i] + (v - i) * rowHs[i];
  };
  const box = (c, r, span = 1) => ({ x: X(c) + colGap / 2, y: rowTop[r] + rowGap / 2, w: span * colW - colGap, h: rowHs[r] - rowGap });
  return { X, Y, box, rowTop, rowHs, width: padX + cols * colW + padRight, height: acc + padY };
}

const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** The point on box `b`'s border where a straight orthogonal segment toward `t` leaves it. */
function snap(b, t) {
  const inX = t.x >= b.x && t.x <= b.x + b.w;
  const inY = t.y >= b.y && t.y <= b.y + b.h;
  if (inX && !inY) return { x: t.x, y: t.y < b.y ? b.y : b.y + b.h };
  if (inY && !inX) return { x: t.x < b.x ? b.x : b.x + b.w, y: t.y };
  const c = center(b);
  const dx = t.x - c.x;
  const dy = t.y - c.y;
  if (Math.abs(dx) / b.w > Math.abs(dy) / b.h) return { x: dx > 0 ? b.x + b.w : b.x, y: c.y };
  return { x: c.x, y: dy > 0 ? b.y + b.h : b.y };
}

function routePoints(grid, a, b, via = []) {
  const pts = via.map(([vx, vy]) => ({ x: grid.X(vx), y: grid.Y(vy) }));
  const s = snap(a, pts[0] ?? center(b));
  const e = snap(b, pts.at(-1) ?? center(a));
  return [s, ...pts, e];
}

function labelSvg(text, x, y, anchor = 'middle', fs = FONT) {
  const lines = String(text).split('\n');
  const lh = fs + 2;
  const w = Math.max(...lines.map((l) => textWidth(l, fs))) + 8;
  const h = lines.length * lh + 4;
  const rx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w + 4 : x - 4;
  const top = y - h / 2;
  const tspans = lines.map((l, i) => `<tspan x="${x}" y="${(top + 2 + lh * (i + 0.5) + fs * 0.35).toFixed(1)}">${escXml(l)}</tspan>`).join('');
  return `<rect class="dg-labelbg" x="${rx.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/><text class="dg-label" text-anchor="${anchor}" font-size="${fs}">${tspans}</text>`;
}

/** One edge: an orthogonal polyline with an arrowhead, and its label on the longest segment. */
function edgeSvg(grid, pfx, boxes, e) {
  const a = boxes.get(e.from);
  const b = boxes.get(e.to);
  if (!a || !b) return '';
  const pts = routePoints(grid, a, b, e.via);
  const kind = e.kind ?? 'plain';
  const arrow = kind === 'part' ? '' : `marker-end="url(#${pfx}-${kind === 'funnel' || kind === 'accent' ? 'accent' : 'ink'})"`;
  const start = e.both ? `marker-start="url(#${pfx}-ink)"` : '';
  const line = `<polyline class="dg-edge k-${kind}" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" ${arrow} ${start}/>`;
  if (!e.label) return line;
  let lx;
  let ly;
  let anchor = e.labelAnchor ?? 'middle';
  if (e.labelPos) {
    lx = grid.X(e.labelPos[0]);
    ly = grid.Y(e.labelPos[1]);
  } else {
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    const p = pts[best];
    const q = pts[best + 1];
    const horizontal = Math.abs(q.y - p.y) < 0.5;
    const lines = String(e.label).split('\n').length;
    if (horizontal) {
      lx = (p.x + q.x) / 2;
      ly = p.y - 6 - (lines * (FONT + 2)) / 2;
    } else {
      lx = p.x + 6;
      ly = (p.y + q.y) / 2;
      anchor = 'start';
    }
  }
  return line + labelSvg(e.label, lx, ly, anchor);
}

function defs(pfx) {
  const marker = (name) => `<marker id="${pfx}-${name}" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path class="dg-head h-${name}" d="M0,0 L10,5 L0,10 z"/></marker>`;
  return `<defs>${marker('ink')}${marker('accent')}</defs>`;
}

function figure({ id, svg, width, height, minWidth, label, caption }) {
  return `<figure class="diagram" id="${id}">
    <div class="diagram-scroll"><svg class="dg" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" style="min-width:${minWidth}px" role="img" aria-label="${escXml(label)}">${svg}</svg></div>
    <figcaption>${caption}</figcaption>
  </figure>`;
}

/** A status mark that never relies on color alone: an icon in a circle plus a <title>. */
function statusDot(STATUS, status, cx, cy, r = 8) {
  return `<circle class="dg-dot s-${status}" cx="${cx}" cy="${cy}" r="${r}"/><text class="dg-dot-icon s-${status}" x="${cx}" y="${cy + 3.6}" text-anchor="middle" font-size="${r + 2}">${escXml(STATUS[status].icon)}</text>`;
}

// ----- 1. Product flow ---------------------------------------------------------------------------

export function productFlow(data, { STATUS, DONE }) {
  const groups = data.groups.filter((g) => g.pos);
  const featuresOf = (gid) => data.features.filter((f) => f.group === gid);
  const PILL = 30;
  const HEAD = 62;
  const cols = 5;
  const colW = 300;
  const colGap = 72;
  const rowGap = 66;
  const trustCols = 4;
  const rowHs = [0, 1, 2].map((r) => {
    const gs = groups.filter((g) => g.pos[1] === r);
    const n = Math.max(...gs.map((g) => {
      const k = featuresOf(g.id).length;
      return g.span ? Math.ceil(k / trustCols) : k;
    }));
    return HEAD + n * PILL + 14 + rowGap;
  });
  const grid = makeGrid({ cols, colW, colGap, rowHs, rowGap, padY: 4 });
  const boxes = new Map(groups.map((g) => [g.id, grid.box(g.pos[0], g.pos[1], g.span ?? 1)]));
  // Number the boxes along the paying path (the funnel edges), from the one nothing leads into.
  const funnelEdges = (data.flowEdges ?? []).filter((e) => e.kind === 'funnel');
  const order = [];
  let cur = funnelEdges.find((e) => !funnelEdges.some((x) => x.to === e.from))?.from;
  while (cur && !order.includes(cur)) {
    order.push(cur);
    cur = funnelEdges.find((e) => e.from === cur)?.to;
  }

  const pill = (f, x, y, w, dark) => {
    const st = f.status;
    const label = fit(f.name, w - 36, 12);
    return `<a href="#f-${escXml(f.id)}" data-jump="${escXml(f.id)}" class="dg-pill-link"><title>${escXml(`${f.name}: ${STATUS[st].label}`)}</title><rect class="dg-pill s-${st}${dark ? ' on-dark' : ''}" x="${x}" y="${y}" width="${w}" height="${PILL - 6}" rx="${(PILL - 6) / 2}"/>${statusDot(STATUS, st, x + 13, y + (PILL - 6) / 2, 7.5)}<text class="dg-pill-text${dark ? ' on-dark' : ''}" x="${x + 27}" y="${y + (PILL - 6) / 2 + 4.2}" font-size="12">${escXml(label)}</text></a>`;
  };

  const nodes = groups.map((g) => {
    const b = boxes.get(g.id);
    const fs = featuresOf(g.id);
    const counted = fs.filter((f) => f.status !== 'idea');
    const live = counted.filter((f) => DONE.has(f.status)).length;
    const dark = g.id === 'trust';
    const step = order.indexOf(g.id) + 1;
    const tx = step ? b.x + 48 : b.x + 18;
    let pills;
    if (dark) {
      const pw = (b.w - 32 - (trustCols - 1) * 10) / trustCols;
      pills = fs.map((f, i) => pill(f, b.x + 16 + (i % trustCols) * (pw + 10), b.y + HEAD - 4 + Math.floor(i / trustCols) * PILL, pw, true)).join('');
    } else {
      pills = fs.map((f, i) => pill(f, b.x + 12, b.y + HEAD + i * PILL, b.w - 24, false)).join('');
    }
    const head = dark
      ? `<text class="dg-group-title on-dark" x="${b.x + 18}" y="${b.y + 27}" font-size="17">${escXml(`${g.name}: ${g.title}`)}</text><text class="dg-group-sub on-dark" x="${b.x + 18}" y="${b.y + 45}" font-size="11.5">${escXml(fit(g.blurb, b.w - 160, 11.5))}</text>`
      : `${step ? `<circle class="dg-step" cx="${b.x + 26}" cy="${b.y + 28}" r="14"/><text class="dg-step-text" x="${b.x + 26}" y="${b.y + 33}" text-anchor="middle" font-size="14">${step}</text>` : ''}<text class="dg-group-title" x="${tx}" y="${b.y + 26}" font-size="16">${escXml(fit(g.name, b.x + b.w - 70 - tx, 16, 'bold'))}</text><text class="dg-group-sub" x="${tx}" y="${b.y + 43}" font-size="11.5">${escXml(g.title)}</text>`;
    const count = `<text class="dg-count${dark ? ' on-dark' : ''}" x="${b.x + b.w - 14}" y="${b.y + 24}" text-anchor="end" font-size="11">${live}/${counted.length} live</text>`;
    return `<g><rect class="dg-group${dark ? ' dark' : ''}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="20"/>${head}${count}${pills}</g>`;
  }).join('');

  const edges = (data.flowEdges ?? []).map((e) => edgeSvg(grid, 'pf', boxes, e)).join('');
  return figure({
    id: 'flow-diagram',
    width: grid.width,
    height: grid.height,
    minWidth: 980,
    label: 'Product flow: the daily game brings players in, they build a profile, see their forecast and moves, then the paywall; the check-in and the daily game bring them back, and share grids bring new players.',
    caption: '<b>Orange arrows</b> are the paying path: game → your own numbers → forecast → paywall. <b>Black arrows</b> are the loops that bring people back (daily set, monthly check-in) and bring new people in (shared grids). Every pill is a feature; tap it for its parts.',
    svg: `${defs('pf')}${nodes}${edges}`,
  });
}

// ----- 2. Screen map -----------------------------------------------------------------------------

export function screenMap(data, { STATUS }) {
  const grid = makeGrid({ cols: 7, colW: 190, colGap: 50, rowHs: Array(5).fill(108), rowGap: 46, padRight: 60 });
  const boxes = new Map(data.screens.map((s) => [s.id, grid.box(s.pos[0], s.pos[1])]));
  const nodes = data.screens.map((s) => {
    const b = boxes.get(s.id);
    const st = s.status;
    const href = s.feature ? `href="#f-${escXml(s.feature)}" data-jump="${escXml(s.feature)}"` : '';
    return `<a ${href} class="dg-pill-link"><title>${escXml(`${s.id} ${s.name} (${s.route}): ${STATUS[st].label}`)}</title><rect class="dg-node s-${st}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12"/>
      <text class="dg-id" x="${b.x + 10}" y="${b.y + 17}" font-size="11">${escXml(s.id)}</text>${statusDot(STATUS, st, b.x + b.w - 14, b.y + 14, 7.5)}
      <text class="dg-node-title" x="${b.x + 10}" y="${b.y + 36}" font-size="12.5">${escXml(fit(s.short, b.w - 18, 12.5, 'bold'))}</text>
      <text class="dg-route" x="${b.x + 10}" y="${b.y + 52}" font-size="10.5">${escXml(fit(s.route, b.w - 18, 10.5, 'mono'))}</text></a>`;
  }).join('');
  const edges = (data.screenEdges ?? []).map((e) => edgeSvg(grid, 'sm', boxes, e)).join('');
  return figure({
    id: 'screen-diagram',
    width: grid.width,
    height: grid.height,
    minWidth: 1000,
    label: 'Screen map: from the game (S2, S3) the user goes to guess yourself (S5) and the ladder S6 to S9, then the forecast S10 and the paywall S15; Today (S1) links to the game, the forecast, the tools S11 to S14 and the micro-tools S21 and S23.',
    caption: '<b>Orange</b> is the demo path from the game to the paywall; the statement upload (S9) can be skipped. <b>Dotted</b> lines join a screen to a mode or panel of it. Solid outlines are built screens; dashed outlines are not built yet. Tap a screen to open its feature.',
    svg: `${defs('sm')}${nodes}${edges}`,
  });
}

// ----- 3. System map -----------------------------------------------------------------------------

export function systemMap(data, { STATUS }) {
  const sys = data.system;
  const grid = makeGrid({ cols: 8, colW: 166, colGap: 26, rowHs: Array(sys.lanes.length).fill(122), rowGap: 56, padY: 0 });
  const boxes = new Map(sys.nodes.map((n) => [n.id, grid.box(n.pos[0], n.pos[1], n.span ?? 1)]));
  const lanes = sys.lanes.map((name, r) => `<rect class="dg-lane${r % 2 ? ' alt' : ''}" x="0" y="${grid.rowTop[r]}" width="${grid.width}" height="${grid.rowHs[r]}"/><text class="dg-lane-label" x="12" y="${grid.rowTop[r] + 17}" font-size="10.5">${escXml(name.toUpperCase())}</text>`).join('');
  const nodes = sys.nodes.map((n) => {
    const b = boxes.get(n.id);
    const st = n.status;
    return `<g><title>${escXml(`${n.label}: ${n.sub} (${STATUS[st].label}${n.external ? ', external service' : ''})`)}</title><rect class="dg-node s-${st}${n.external ? ' ext' : ''}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10"/>
      ${statusDot(STATUS, st, b.x + b.w - 13, b.y + 13, 7)}
      <text class="dg-node-title" x="${b.x + 10}" y="${b.y + 22}" font-size="12.5">${escXml(fit(n.label, b.w - 32, 12.5, 'bold'))}</text>
      <text class="dg-route" x="${b.x + 10}" y="${b.y + 39}" font-size="10.5">${escXml(fit(n.sub, b.w - 18, 10.5, 'mono'))}</text>
      <text class="dg-status-text s-${st}" x="${b.x + 10}" y="${b.y + 55}" font-size="10">${escXml(`${STATUS[st].label}${n.external ? ' · external' : ''}`)}</text></g>`;
  }).join('');

  // The fetch bus: every server route is reached from the view-models over one boundary.
  let bus = '';
  if (sys.bus) {
    const from = boxes.get(sys.bus.from);
    const targets = sys.nodes.filter((n) => n.pos[1] === sys.bus.row).map((n) => boxes.get(n.id));
    const y = grid.Y(sys.bus.row - 0.14); // in the gap above the lane, clear of its label
    const xs = targets.map((t) => t.x + t.w / 2);
    const fx = from.x + from.w / 2;
    bus += `<line class="dg-edge k-plain" x1="${Math.min(...xs, fx)}" y1="${y}" x2="${Math.max(...xs, fx)}" y2="${y}"/>`;
    bus += `<line class="dg-edge k-plain" x1="${fx}" y1="${from.y + from.h}" x2="${fx}" y2="${y}"/><circle class="dg-junction" cx="${fx}" cy="${y}" r="3.5"/>`;
    bus += targets.map((t) => `<line class="dg-edge k-plain" x1="${t.x + t.w / 2}" y1="${y}" x2="${t.x + t.w / 2}" y2="${t.y}" marker-end="url(#sy-ink)"/>`).join('');
    if (sys.bus.label) bus += labelSvg(sys.bus.label, grid.X(sys.bus.labelPos[0]), grid.Y(sys.bus.labelPos[1]), sys.bus.labelAnchor ?? 'start');
  }
  const edges = sys.edges.map((e) => edgeSvg(grid, 'sy', boxes, e)).join('');
  return figure({
    id: 'system-diagram',
    width: grid.width,
    height: grid.height,
    minWidth: 1000,
    label: 'System map: the browser holds the screens, view-models, local state and the CSV reader; it calls the Next.js routes over JSON; the routes use the card data, the Postgres store, Stripe and Claude; the engine is shared by the browser and the server; CI deploys to Docker on the team server behind Tailscale Funnel.',
    caption: 'The browser reaches the server only through the routes, as JSON with the anonymous ID in a header (never in a URL). <b>Orange arrows</b> are the privacy boundary: a statement is read and masked in the browser, and only merchant labels and amounts go to the server and on to Claude. The answers to the game (cards) never leave the server. The engine is one package used on both sides, so a preview in the browser and a check on the server do the same math.',
    svg: `${defs('sy')}${lanes}${bus}${nodes}${edges}`,
  });
}

export const DIAGRAM_STYLES = String.raw`
.diagram { margin: 0; background: var(--color-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); padding: var(--spacing-lg); }
.diagram + .diagram, .diagram + .table-wrap { margin-top: var(--spacing-xl); }
.diagram-scroll { overflow-x: auto; }
.dg { display: block; width: 100%; height: auto; color: var(--color-text); font-family: var(--font-sans); }
.diagram figcaption { margin-top: var(--spacing-md); font-size: var(--text-sm); color: var(--color-text-muted); max-width: 900px; }
.diagram figcaption b { color: var(--color-text); }
.dg-edge { fill: none; stroke: var(--color-text); stroke-width: 1.6; stroke-linejoin: round; }
.dg-edge.k-funnel, .dg-edge.k-accent { stroke: var(--color-primary); stroke-width: 2.4; }
.dg-edge.k-loop { stroke: var(--color-text); stroke-width: 2; }
.dg-edge.k-part { stroke: var(--color-text-muted); stroke-dasharray: 2 4; stroke-linecap: round; stroke-width: 1.8; }
.dg-head.h-ink { fill: var(--color-text); }
.dg-head.h-accent { fill: var(--color-primary); }
.dg-junction { fill: var(--color-text); }
.dg-labelbg { fill: var(--color-surface); opacity: 0.94; }
.dg-label { fill: var(--color-text); font-weight: 600; }
.dg-group { fill: var(--color-bg); stroke: var(--color-border); stroke-width: 1.5; }
.dg-group.dark { fill: var(--color-ink); stroke: none; }
.dg-step { fill: var(--color-primary); }
.dg-step-text { fill: var(--color-on-primary); font-family: var(--font-display); font-weight: 800; }
.dg-group-title { fill: var(--color-text); font-family: var(--font-display); font-weight: 800; }
.dg-group-sub, .dg-count { fill: var(--color-text-muted); font-weight: 600; }
.on-dark.dg-group-title, .on-dark.dg-pill-text { fill: var(--color-on-primary); }
.on-dark.dg-group-sub, .on-dark.dg-count { fill: rgb(255 255 255 / 0.65); }
.dg-pill { fill: var(--color-surface); stroke: var(--color-border); stroke-width: 1.2; }
.dg-pill.on-dark { fill: rgb(255 255 255 / 0.08); stroke: rgb(255 255 255 / 0.2); }
.dg-pill.s-idea { fill: none; stroke-dasharray: 4 3; stroke: var(--color-text-muted); }
.dg-pill-text { fill: var(--color-text); font-weight: 500; }
.dg-pill-link { cursor: pointer; }
.dg-pill-link:hover .dg-pill, .dg-pill-link:focus .dg-pill, .dg-pill-link:hover .dg-node, .dg-pill-link:focus .dg-node { stroke: var(--color-primary); stroke-width: 2; }
.dg-dot { stroke: none; }
.dg-dot.s-live, .dg-dot.s-polish { fill: var(--color-positive); }
.dg-dot.s-preview { fill: var(--color-ink); }
.dg-dot.s-review { fill: var(--color-chart-1); }
.dg-dot.s-building { fill: var(--color-warning); }
.dg-dot.s-todo { fill: var(--color-surface-strong); stroke: var(--color-border); }
.dg-dot.s-idea { fill: none; stroke: var(--color-text-muted); stroke-dasharray: 2 2; }
.dg-dot.s-check { fill: var(--color-negative); }
.dg-dot-icon { font-weight: 700; fill: #fff; }
.dg-dot-icon.s-building { fill: var(--color-ink); }
.dg-dot-icon.s-todo, .dg-dot-icon.s-idea { fill: var(--color-text-muted); }
.dg-node { stroke-width: 1.6; }
.dg-node.s-live, .dg-node.s-polish { fill: var(--color-positive-soft); stroke: var(--color-positive); }
.dg-node.s-preview { fill: var(--color-surface-strong); stroke: var(--color-text); }
.dg-node.s-review { fill: #e4ecfd; stroke: var(--color-chart-1); }
.dg-node.s-building { fill: #fdf0d3; stroke: var(--color-warning); }
.dg-node.s-todo { fill: var(--color-surface); stroke: var(--color-text-muted); stroke-dasharray: 5 4; }
.dg-node.s-idea { fill: none; stroke: var(--color-text-muted); stroke-dasharray: 2 4; }
.dg-node.s-check { fill: #fbe2de; stroke: var(--color-negative); }
.dg-node.ext { stroke-width: 2.6; }
.dg-id { fill: var(--color-text-muted); font-family: var(--font-mono); font-weight: 700; }
.dg-node-title { fill: var(--color-text); font-weight: 700; }
.dg-route { fill: var(--color-text-muted); font-family: var(--font-mono); }
.dg-status-text { fill: var(--color-text-muted); font-weight: 700; }
.dg-status-text.s-live, .dg-status-text.s-polish { fill: #13774a; }
.dg-status-text.s-review { fill: #2b5cc4; }
.dg-lane { fill: var(--color-surface); }
.dg-lane.alt { fill: var(--color-bg); }
.dg-lane-label { fill: var(--color-text-muted); font-weight: 700; letter-spacing: 0.06em; }
`;
