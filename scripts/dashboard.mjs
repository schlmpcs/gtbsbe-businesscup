#!/usr/bin/env node
// docs/dashboard/features.json + GitHub issues + git → docs/dashboard/index.html
//
// The product map: every feature (built, in progress, planned or proposed), the funnel, the
// judging criteria and the screens, in the app's own design tokens. Nothing in the page is typed
// by hand except features.json: each part's status is checked against the code on origin/main
// (and on a feature branch), and against its GitHub issues.
//
// Usage: node scripts/dashboard.mjs [options]          (or: pnpm dashboard)
//   --no-fetch         don't `git fetch origin` first (use the remote refs you already have)
//   --offline          don't ask GitHub for issue states (statuses then come from code alone)
//   --ref <ref>        the branch that counts as shipped (default origin/main)
//   --funnel-url <url> also fetch real funnel counts from <url>/api/events/funnel (the live app)
//   --days <n>         window for --funnel-url, 1–90 days (default 7)
//   --out <path>       where to write the page (default docs/dashboard/index.html)
//   --check            exit 1 if the data checks find a problem (for CI or a pre-commit run)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIAGRAM_STYLES, productFlow, screenMap, systemMap } from './dashboard-diagrams.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ----- arguments --------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { fetch: true, offline: false, ref: 'origin/main', funnelUrl: null, days: 7, out: 'docs/dashboard/index.html', check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) fail(`${a} needs a value`);
      return v;
    };
    if (a === '--no-fetch') opts.fetch = false;
    else if (a === '--offline') opts.offline = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--ref') opts.ref = value();
    else if (a === '--funnel-url') opts.funnelUrl = value().replace(/\/+$/, '');
    else if (a === '--out') opts.out = value();
    else if (a === '--days') {
      opts.days = Number(value());
      if (!Number.isInteger(opts.days) || opts.days < 1 || opts.days > 90) fail('--days must be a whole number from 1 to 90');
    } else if (a === '--help' || a === '-h') {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(0);
    } else fail(`unknown option ${a} (try --help)`);
  }
  return opts;
}

function fail(message) {
  console.error(`dashboard: ${message}`);
  process.exit(1);
}

// ----- git and GitHub ---------------------------------------------------------------------------

function run(cmd, args, { quiet = false } = {}) {
  try {
    return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', quiet ? 'ignore' : 'pipe'] });
  } catch {
    return null;
  }
}

const git = (...args) => run('git', args, { quiet: true });

function resolveRef(name) {
  for (const candidate of [name, `origin/${name}`]) {
    const sha = git('rev-parse', '--verify', '--quiet', `${candidate}^{commit}`);
    if (sha) return { ref: candidate, sha: sha.trim() };
  }
  return null;
}

/** Every file path in a commit, as a Set (folders are matched by prefix later). */
function filesAt(ref) {
  const out = git('ls-tree', '-r', '--name-only', ref);
  return out === null ? null : new Set(out.split('\n').filter(Boolean));
}

function repoUrl() {
  const remote = git('remote', 'get-url', 'origin')?.trim();
  if (!remote) return null;
  const m = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return m ? `https://github.com/${m[1]}` : null;
}

/** Issues and pull requests by number (a part may cite either; a merged PR counts as closed). */
function githubIssues() {
  const fields = ['--state', 'all', '--limit', '1000', '--json', 'number,title,state,url'];
  const issues = run('gh', ['issue', 'list', ...fields]);
  if (issues === null) return null;
  const prs = run('gh', ['pr', 'list', ...fields]);
  try {
    const map = new Map(JSON.parse(issues).map((i) => [i.number, { ...i, kind: 'issue' }]));
    for (const pr of prs === null ? [] : JSON.parse(prs)) {
      map.set(pr.number, { ...pr, kind: 'pr', merged: pr.state === 'MERGED', state: pr.state === 'OPEN' ? 'OPEN' : 'CLOSED' });
    }
    return map;
  } catch {
    return null;
  }
}

/** The quoted strings inside `export const NAME = [ ... ]` in a TypeScript source. */
function constList(source, name) {
  const m = source?.match(new RegExp(`export const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  return m ? [...m[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((x) => x[1] ?? x[2]) : null;
}

async function liveFunnel(url, days) {
  try {
    const res = await fetch(`${url}/api/events/funnel?days=${days}`, { signal: AbortSignal.timeout(15000) });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.ok) return { error: `HTTP ${res.status}${body?.error ? ` (${body.error})` : ''}` };
    return { report: body };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// ----- design tokens (from the shipped tokens.json, so the page matches the app) ----------------

const NAMESPACES = { color: 'color', font: 'font', text: 'text', leading: 'leading', fontWeight: 'font-weight', spacing: 'spacing', radius: 'radius', shadow: 'shadow' };

function tokensCss(tokens) {
  const lines = [];
  const refVar = (v) => v.replace(/^\{(.+)\}$/, (_, path) => {
    const [group, ...rest] = path.split('.');
    return `var(--${NAMESPACES[group] ?? group}-${rest.join('-')})`;
  });
  const walk = (node, prefix, group) => {
    for (const [key, val] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      if (val && typeof val === 'object' && '$value' in val) {
        let v = val.$value;
        if (Array.isArray(v)) v = v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
        else if (typeof v === 'number' && (group === 'spacing' || group === 'radius')) v = `${v}px`;
        else if (typeof v === 'string') v = refVar(v);
        lines.push(`  --${prefix}-${key}: ${v};`);
      } else if (val && typeof val === 'object') walk(val, `${prefix}-${key}`, group);
    }
  };
  for (const [group, ns] of Object.entries(NAMESPACES)) if (tokens[group]) walk(tokens[group], ns, group);
  return `:root {\n${lines.join('\n')}\n}`;
}

// ----- statuses ---------------------------------------------------------------------------------

const STATUS = {
  live: { label: 'Live', icon: '✓', hint: 'On main and deployed' },
  preview: { label: 'Live preview', icon: '◑', hint: 'On main as a clickable preview on real data' },
  polish: { label: 'Live · follow-ups', icon: '✓', hint: 'On main; its issue still has open follow-ups' },
  review: { label: 'Built · not merged', icon: '⑂', hint: 'Built on a branch, waiting to merge' },
  building: { label: 'In progress', icon: '◐', hint: 'Some parts are on main, the rest is not' },
  todo: { label: 'To build', icon: '○', hint: 'Agreed, not built yet' },
  idea: { label: 'Proposal', icon: '◇', hint: 'Proposed in PRODUCT-NEXT or a brief; not agreed yet' },
  check: { label: 'Check', icon: '!', hint: 'The data disagree (e.g. a closed issue but no code on main)' },
};
const DONE = new Set(['live', 'preview', 'polish']);

function createChecker({ mainFiles, issues, branches }) {
  const has = (files, p) => (p.endsWith('/') ? [...files].some((f) => f.startsWith(p)) : files.has(p));
  const branchFiles = new Map();
  const filesOn = (b) => {
    if (!branchFiles.has(b.ref)) branchFiles.set(b.ref, filesAt(b.ref) ?? new Set());
    return branchFiles.get(b.ref);
  };

  return function partStatus(part, feature) {
    const paths = part.paths ?? [];
    const nums = part.issues ?? [];
    const found = issues ? nums.map((n) => issues.get(n)).filter(Boolean) : [];
    const open = found.filter((i) => i.state === 'OPEN');
    const allClosed = issues !== null && nums.length > 0 && found.length === nums.length && open.length === 0;
    const onMain = paths.filter((p) => has(mainFiles, p));
    const missing = paths.filter((p) => !has(mainFiles, p));
    const branch = part.branch ? branches.get(part.branch) : null;
    const evidence = { onMain, missing, open: open.map((i) => i.number) };

    if (part.status) return { status: part.status, manual: true, evidence };
    if (paths.length > 0 && missing.length === 0) {
      if (open.length > 0) return { status: 'polish', evidence };
      return { status: part.kind === 'preview' ? 'preview' : 'live', evidence };
    }
    if (branch?.ahead > 0 && (paths.length === 0 || missing.every((p) => has(filesOn(branch), p)))) {
      return { status: 'review', evidence: { ...evidence, branch } };
    }
    if (onMain.length > 0) return { status: 'building', evidence };
    if (paths.length === 0 && allClosed) return { status: part.kind === 'preview' ? 'preview' : 'live', evidence };
    if (paths.length > 0 && allClosed) return { status: 'check', evidence, problem: `issue${nums.length > 1 ? 's' : ''} ${nums.map((n) => `#${n}`).join(', ')} closed, but ${missing.join(', ')} not on main` };
    return { status: feature.proposal ? 'idea' : 'todo', evidence };
  };
}

/** One status for a feature from its parts (parts with scope "later" don't count). */
function rollUp(parts, feature) {
  const counted = parts.filter((p) => p.scope !== 'later');
  const s = counted.map((p) => p.result.status);
  if (s.length === 0) return feature.proposal ? 'idea' : 'todo';
  if (s.includes('check')) return 'check';
  if (s.every((x) => x === 'live')) return 'live';
  if (s.every((x) => x === 'live' || x === 'preview')) return 'preview';
  if (s.every((x) => DONE.has(x))) return 'polish';
  if (s.every((x) => x === 'idea')) return 'idea';
  if (s.every((x) => x === 'todo' || x === 'idea')) return feature.proposal ? 'idea' : 'todo';
  if (s.every((x) => DONE.has(x) || x === 'review')) return 'review';
  return 'building';
}

// ----- HTML helpers -----------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** Escaped text with `code` spans. */
const rich = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const pill = (status, extra = '') => `<span class="pill s-${status}" title="${esc(STATUS[status].hint)}"><span aria-hidden="true">${STATUS[status].icon}</span>${esc(STATUS[status].label)}${extra}</span>`;
const fmtInt = (n) => new Intl.NumberFormat('en-US').format(n);
const pct = (x) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);

// ----- main -------------------------------------------------------------------------------------

async function build() {
  const opts = parseArgs(process.argv.slice(2));
  const warnings = [];
  const warn = (m) => {
    if (!warnings.includes(m)) warnings.push(m);
  };

  const dataPath = resolve(root, 'docs/dashboard/features.json');
  let data;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf8'));
  } catch (err) {
    fail(`can't read ${relative(root, dataPath)}: ${err.message}`);
  }

  if (opts.fetch && git('fetch', '--quiet', 'origin') === null) warn('git fetch origin failed; using the remote refs already on disk.');
  const main = resolveRef(opts.ref) ?? fail(`can't find ${opts.ref}`);
  const mainFiles = filesAt(main.ref) ?? fail(`can't list files on ${main.ref}`);
  const mainDate = git('log', '-1', '--format=%cI', main.ref)?.trim();
  const mainSubject = git('log', '-1', '--format=%s', main.ref)?.trim();

  const issues = opts.offline ? null : githubIssues();
  if (!opts.offline && issues === null) warn('Could not read GitHub issues (is `gh` installed and logged in?). Statuses come from the code alone; open follow-ups are not shown.');

  const tokensSrc = git('show', `${main.ref}:tokens.json`) ?? readFileSync(resolve(root, 'tokens.json'), 'utf8');
  const css = tokensCss(JSON.parse(tokensSrc));

  const constants = git('show', `${main.ref}:packages/types/constants.ts`);
  const funnelSteps = constList(constants, 'FUNNEL_STEPS') ?? [];
  const trackedEvents = new Set([...(constList(constants, 'CLIENT_EVENT_NAMES') ?? []), ...(constList(constants, 'SERVER_EVENT_NAMES') ?? [])]);
  if (funnelSteps.length === 0) warn(`FUNNEL_STEPS not found in packages/types/constants.ts on ${main.ref}.`);

  let funnelLive = null;
  if (opts.funnelUrl) {
    funnelLive = await liveFunnel(opts.funnelUrl, opts.days);
    if (funnelLive.error) warn(`Live funnel numbers unavailable: ${funnelLive.error}`);
  }

  // Branches named by parts: how far ahead of main they are.
  const branches = new Map();
  for (const f of data.features) {
    for (const p of f.parts ?? []) {
      if (!p.branch || branches.has(p.branch)) continue;
      const r = resolveRef(p.branch);
      if (!r) {
        warn(`${f.id}: branch ${p.branch} not found locally or on origin.`);
        branches.set(p.branch, null);
        continue;
      }
      const ahead = Number(git('rev-list', '--count', `${main.ref}..${r.ref}`)?.trim() ?? 0);
      const date = git('log', '-1', '--format=%cI', r.ref)?.trim();
      branches.set(p.branch, { name: p.branch, ref: r.ref, ahead, date });
    }
  }

  // Validate the catalogue.
  const groupIds = new Set(data.groups.map((g) => g.id));
  const stageIds = new Set(data.funnel.map((s) => s.id));
  const judgeIds = new Set(data.judging.map((j) => j.id));
  const ownerIds = new Set(Object.keys(data.owners));
  const featureIds = new Set();
  for (const f of data.features) {
    if (featureIds.has(f.id)) warn(`Duplicate feature id ${f.id}.`);
    featureIds.add(f.id);
    if (!groupIds.has(f.group)) warn(`${f.id}: unknown group "${f.group}".`);
    if (f.funnel && !stageIds.has(f.funnel)) warn(`${f.id}: unknown funnel stage "${f.funnel}".`);
    for (const o of f.owners ?? []) if (!ownerIds.has(o)) warn(`${f.id}: unknown owner "${o}".`);
    for (const j of f.judging ?? []) if (!judgeIds.has(j)) warn(`${f.id}: unknown judging criterion "${j}".`);
    for (const e of f.events ?? []) if (!trackedEvents.has(e)) warn(`${f.id}: event "${e}" is not in the event names on ${main.ref}.`);
    for (const p of f.parts ?? []) for (const n of p.issues ?? []) if (issues && !issues.has(n)) warn(`${f.id}: #${n} is not an issue or pull request on GitHub.`);
    if (!f.parts?.length) warn(`${f.id}: has no parts.`);
  }
  for (const s of data.screens) if (s.feature && !featureIds.has(s.feature)) warn(`Screen ${s.id}: unknown feature ${s.feature}.`);
  for (const d of data.decisions) for (const b of d.blocks ?? []) if (!featureIds.has(b)) warn(`Decision "${d.q}": unknown feature ${b}.`);
  const checkEdges = (name, edges, ids) => {
    for (const e of edges ?? []) for (const end of [e.from, e.to]) if (!ids.has(end)) warn(`${name}: edge ${e.from} → ${e.to} names unknown node ${end}.`);
  };
  checkEdges('Product flow', data.flowEdges, new Set(data.groups.filter((g) => g.pos).map((g) => g.id)));
  checkEdges('Screen map', data.screenEdges, new Set(data.screens.filter((s) => s.pos).map((s) => s.id)));
  checkEdges('System map', data.system?.edges, new Set((data.system?.nodes ?? []).map((n) => n.id)));
  for (const s of data.screens) if (!s.pos) warn(`Screen ${s.id}: no pos, so it is left out of the screen map.`);

  // Statuses.
  const partStatus = createChecker({ mainFiles, issues, branches });
  for (const f of data.features) {
    for (const p of f.parts) {
      p.result = partStatus(p, f);
      if (p.result.problem) warn(`${f.id} · ${p.label}: ${p.result.problem}.`);
    }
    f.status = rollUp(f.parts, f);
    const counted = f.parts.filter((p) => p.scope !== 'later');
    f.done = counted.filter((p) => DONE.has(p.result.status)).length;
    f.total = counted.length;
  }
  const screenCheck = createChecker({ mainFiles, issues, branches });
  for (const s of data.screens) {
    const feat = data.features.find((f) => f.id === s.feature);
    s.status = s.paths ? screenCheck(s, { proposal: s.proposal }).status : (feat?.status ?? 'todo');
    if (s.status === 'building') s.status = 'todo';
  }
  for (const n of data.system?.nodes ?? []) {
    const r = screenCheck(n, {});
    n.status = r.status;
    if (r.problem) warn(`System map · ${n.label}: ${r.problem}.`);
  }

  const html = render({ data, css, main, mainDate, mainSubject, issues, branches, funnelSteps, trackedEvents, funnelLive, opts, warnings, repo: repoUrl() });
  const outPath = resolve(root, opts.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);

  const count = (st) => data.features.filter((f) => f.status === st).length;
  console.log(`dashboard: wrote ${relative(root, outPath)} (${data.features.length} features: ${Object.keys(STATUS).map((s) => `${count(s)} ${STATUS[s].label.toLowerCase()}`).filter((x) => !x.startsWith('0 ')).join(', ')})`);
  console.log(`           ${main.ref} @ ${main.sha.slice(0, 7)}${issues ? `, ${issues.size} GitHub issues and PRs` : ', no GitHub data'}${funnelLive?.report ? ', live funnel numbers' : ''}`);
  for (const w of warnings) console.warn(`  ! ${w}`);
  if (opts.check && warnings.length > 0) process.exit(1);
}

// ----- page -------------------------------------------------------------------------------------

function render(ctx) {
  const { data, css, main, mainDate, issues, branches, funnelSteps, trackedEvents, funnelLive, opts, warnings, repo } = ctx;
  const features = data.features;
  const byId = new Map(features.map((f) => [f.id, f]));
  const owners = data.owners;
  const generated = new Date();
  const fmtDate = (d) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(d));

  const issueLink = (n) => {
    const i = issues?.get(n);
    const label = `#${n}`;
    const state = i ? (i.state === 'OPEN' ? 'open' : 'closed') : 'unknown';
    const title = i ? `${i.kind === 'pr' ? 'PR' : 'Issue'}: ${i.title} (${i.merged ? 'merged' : state})` : `Issue ${label}`;
    const href = i?.url ?? (repo ? `${repo}/issues/${n}` : null);
    const inner = `<span class="iss iss-${state}" title="${esc(title)}">${label}</span>`;
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${inner}</a>` : inner;
  };
  const docLink = (path) => (repo ? `<a href="${esc(`${repo}/blob/main/${path}`)}" target="_blank" rel="noopener"><code>${esc(path)}</code></a>` : `<code>${esc(path)}</code>`);
  const chip = (f) => `<a class="chip s-${f.status}" href="#f-${esc(f.id)}" data-jump="${esc(f.id)}" title="${esc(STATUS[f.status].label)}"><span class="chip-icon" aria-hidden="true">${STATUS[f.status].icon}</span>${esc(f.name)}<span class="sr-only"> (${esc(STATUS[f.status].label)})</span></a>`;

  // Headline numbers.
  const n = (pred) => features.filter(pred).length;
  const product = features.filter((f) => f.group !== 'ship');
  const live = n((f) => f.group !== 'ship' && DONE.has(f.status));
  const demo = product.filter((f) => f.demo);
  const demoLive = demo.filter((f) => DONE.has(f.status)).length;
  const extras = product.filter((f) => f.tier === 'extra');
  const extrasLive = extras.filter((f) => DONE.has(f.status)).length;
  const scoreboard = [
    { v: live, l: 'features live', tone: 'positive' },
    { v: n((f) => f.status === 'review'), l: 'built, not merged', tone: 'blue' },
    { v: n((f) => f.status === 'building' || f.status === 'check'), l: 'in progress' },
    { v: n((f) => f.status === 'todo'), l: 'to build', tone: 'primary' },
    { v: n((f) => f.status === 'idea'), l: 'proposals' },
  ];

  // ---- architecture
  const groupFeatures = (gid) => features.filter((f) => f.group === gid);
  const architecture = `
  <section id="architecture" aria-labelledby="h-arch">
    <div class="section-head">
      <span class="sticker ink">Product architecture</span>
      <h2 id="h-arch">From a stranger's home to a paying user</h2>
      <p class="muted">Each box is one job the product does; the arrows are how a person moves between them. Every pill is a feature with its live status: tap it to see its parts.</p>
    </div>
    ${productFlow(data, { STATUS, DONE })}
  </section>`;

  // ---- funnel
  const report = funnelLive?.report ?? null;
  const stepData = new Map((report?.steps ?? []).map((s) => [s.name, s]));
  const top = report?.steps?.[0]?.funnel || 0;
  const funnelRows = data.funnel.map((stage, i) => {
    const fs = features.filter((f) => f.funnel === stage.id);
    const events = stage.events.map((e) => {
      const tracked = trackedEvents.has(e);
      const step = funnelSteps.includes(e);
      const s = stepData.get(e);
      const bar = report && step && s
        ? `<div class="bar" role="img" aria-label="${esc(`${e}: ${s.funnel} people through every step so far${s.conversion !== null ? `, ${pct(s.conversion)} from the step before` : ''}`)}"><span style="width:${top ? Math.max(2, (s.funnel / top) * 100) : 0}%"></span></div><div class="bar-nums"><b>${fmtInt(s.funnel)}</b> people · ${s.conversion === null ? 'start' : `${pct(s.conversion)} of the step before`}</div>`
        : '';
      return `<div class="event"><code>${esc(e)}</code> ${tracked ? `<span class="tracked">✓ tracked${step ? ' · funnel step' : ''}</span>` : '<span class="untracked">○ not tracked yet</span>'}${bar}</div>`;
    }).join('');
    return `
      <li class="stage${stage.loop ? ' loop' : ''}">
        <span class="stage-no" aria-hidden="true">${stage.loop ? '↻' : i + 1}</span>
        <div class="stage-body">
          <div class="stage-title"><h3>${esc(stage.name)}</h3>${stage.screens.length ? `<span class="screens">${stage.screens.map(esc).join(' · ')}</span>` : ''}</div>
          <p class="muted">${esc(stage.what)}</p>
          <div class="chips">${fs.map(chip).join('') || '<span class="muted small">Channel only: no screen of ours.</span>'}</div>
        </div>
        <div class="stage-events">${events || '<span class="muted small">Not measurable in the app (happens off-site).</span>'}</div>
      </li>`;
  }).join('');
  const funnelNote = report
    ? `Live numbers from the app, last ${opts.days} days (${esc(report.from.slice(0, 10))} → ${esc(report.to.slice(0, 10))}): ${fmtInt(report.users)} visitors. Bars count people who went through every step before. Game: finish rate ${pct(report.game?.finishRate)}, share rate ${pct(report.game?.shareRate)}, blind-guess rate ${pct(report.game?.blindGuessRate)}.`
    : `No usage numbers on this page: they are never typed in by hand. Run <code>pnpm dashboard --funnel-url &lt;live app URL&gt;</code> to fill the bars from <code>GET /api/events/funnel</code>.`;
  const funnel = `
  <section id="funnel" aria-labelledby="h-funnel">
    <div class="section-head">
      <span class="sticker ink">Funnel</span>
      <h2 id="h-funnel">Clip → play → guess yourself → forecast → paywall</h2>
      <p class="muted">${funnelNote}</p>
    </div>
    <ol class="stages">${funnelRows}</ol>
  </section>`;

  // ---- feature board
  const ownerNames = (f) => (f.owners ?? []).map((o) => owners[o] ?? o).join(', ');
  const partRow = (p) => {
    const r = p.result;
    const st = r.status;
    const bits = [];
    for (const num of p.issues ?? []) bits.push(issueLink(num));
    if (r.evidence?.branch) bits.push(`<span class="branch" title="${esc(`${r.evidence.branch.ahead} commits ahead of ${main.ref}${r.evidence.branch.date ? `, last ${fmtDate(r.evidence.branch.date)}` : ''}`)}">⑂ ${esc(r.evidence.branch.name)}</span>`);
    if (st === 'building' && r.evidence.missing.length) bits.push(`<span class="small muted">missing: ${r.evidence.missing.map((m) => `<code>${esc(m)}</code>`).join(', ')}</span>`);
    if (r.manual) bits.push('<span class="small muted">(set by hand)</span>');
    return `<li class="part s-${st}${p.scope === 'later' ? ' later' : ''}"><span class="part-icon" title="${esc(STATUS[st].label)}" aria-hidden="true">${STATUS[st].icon}</span><div><span class="part-label">${rich(p.label)}</span><span class="sr-only"> (${esc(STATUS[st].label)})</span>${p.scope === 'later' ? ' <span class="tag-later">later</span>' : ''}${bits.length ? `<div class="part-meta">${bits.join(' ')}</div>` : ''}${p.note ? `<div class="part-note">${rich(p.note)}</div>` : ''}</div></li>`;
  };
  const card = (f) => {
    const progress = f.total ? Math.round((f.done / f.total) * 100) : 0;
    const searchText = [f.id, f.name, f.pitch, ...(f.parts ?? []).map((p) => p.label), ownerNames(f), f.route ?? '', ...(f.screens ?? [])].join(' ').toLowerCase();
    const meta = [
      f.screens?.length ? `<span><b>Screen</b> ${f.screens.map(esc).join(', ')}</span>` : '',
      f.route ? `<span><b>Route</b> <code>${esc(f.route)}</code></span>` : '',
      f.owners?.length ? `<span><b>Owner</b> ${esc(ownerNames(f))}</span>` : '',
      f.events?.length ? `<span><b>Events</b> ${f.events.map((e) => `<code class="${trackedEvents.has(e) ? '' : 'untracked'}">${esc(e)}</code>`).join(' ')}</span>` : '',
      f.doc ? `<span><b>Spec</b> ${docLink(f.doc)}</span>` : '',
    ].filter(Boolean).join('');
    return `
      <article class="fcard" id="f-${esc(f.id)}" data-status="${f.status}" data-tier="${esc(f.tier)}" data-demo="${f.demo ? 1 : 0}" data-owners="${esc((f.owners ?? []).join(' '))}" data-text="${esc(searchText)}">
        <div class="fcard-top">
          <span class="fid">${esc(f.id)}</span>
          ${pill(f.status)}
          ${f.tier === 'extra' ? '<span class="sticker primary tilt">Judge extra</span>' : ''}
          ${f.tier === 'next' ? '<span class="sticker soft">Next</span>' : ''}
          ${f.demo ? '<span class="demo-tag" title="On the 2-minute demo path">▶ Demo</span>' : ''}
        </div>
        <h3>${esc(f.name)}</h3>
        <p class="pitch">${rich(f.pitch)}</p>
        ${f.total ? `<div class="progress" role="img" aria-label="${f.done} of ${f.total} parts done"><span style="width:${progress}%"></span></div><div class="progress-label">${f.done} of ${f.total} parts done</div>` : ''}
        <ul class="parts">${f.parts.map(partRow).join('')}</ul>
        ${f.judgeLine ? `<p class="judge-line"><span aria-hidden="true">“</span>${rich(f.judgeLine)}<span aria-hidden="true">”</span></p>` : ''}
        <div class="fmeta">${meta}</div>
      </article>`;
  };
  const ownerOptions = Object.entries(owners).map(([id, name]) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');
  const board = `
  <section id="board" aria-labelledby="h-board">
    <div class="section-head">
      <span class="sticker ink">Feature board</span>
      <h2 id="h-board">Every feature, built or not</h2>
      <p class="muted">A part is <b>live</b> when its files are on <code>${esc(main.ref)}</code>; <b>built, not merged</b> when they are only on a branch; an open issue on live code shows as <b>follow-ups</b>. Parts marked <span class="tag-later">later</span> are out of the 24-hour scope and don't count.</p>
    </div>
    <div class="filters" role="group" aria-label="Filter features">
      <div class="seg" role="radiogroup" aria-label="Status" data-filter="status">
        ${[['all', 'All'], ['done', '✓ Live'], ['review', '⑂ Not merged'], ['building', '◐ In progress'], ['todo', '○ To build'], ['idea', '◇ Proposals']].map(([v, l], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-value="${v}">${l}</button>`).join('')}
      </div>
      <div class="seg" role="radiogroup" aria-label="Scope" data-filter="tier">
        ${[['all', 'Everything'], ['demo', '▶ Demo path'], ['extra', 'Judge extras'], ['next', 'Next']].map(([v, l], i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-value="${v}">${l}</button>`).join('')}
      </div>
      <label class="select"><span class="sr-only">Owner</span><select data-filter="owner"><option value="all">Any owner</option>${ownerOptions}</select></label>
      <label class="search"><span class="sr-only">Search features</span><input type="search" placeholder="Search features, parts, routes…" data-filter="q"></label>
      <span class="count" aria-live="polite"></span>
    </div>
    ${data.groups.map((g) => {
      const fs = groupFeatures(g.id);
      return fs.length ? `
    <div class="board-group" data-group="${esc(g.id)}">
      <h3 class="group-title">${esc(g.name)} <span class="muted">· ${esc(g.title)}</span></h3>
      <div class="grid">${fs.map(card).join('')}</div>
    </div>` : '';
    }).join('')}
    <p class="empty muted" hidden>No feature matches these filters.</p>
  </section>`;

  // ---- judging
  const judging = `
  <section id="judges" aria-labelledby="h-judges">
    <div class="section-head">
      <span class="sticker ink">Judging</span>
      <h2 id="h-judges">What earns each point</h2>
      <p class="muted">The organizers' five questions, weighted, with the features that answer each one. <b>Demo path:</b> ${demoLive} of ${demo.length} features live. <b>Judge extras:</b> ${extrasLive} of ${extras.length} live.</p>
    </div>
    <div class="judge-grid">
      ${data.judging.map((j) => {
        const fs = product.filter((f) => f.judging?.includes(j.id)).sort((a, b) => Number(DONE.has(b.status)) - Number(DONE.has(a.status)));
        const ready = fs.filter((f) => DONE.has(f.status)).length;
        return `
      <article class="judge-card">
        <div class="judge-weight"><span class="weight">${j.weight}%</span><div class="wbar" aria-hidden="true"><span style="width:${j.weight * 2.5}%"></span></div></div>
        <h3>${esc(j.question)}</h3>
        <p class="muted small">${esc(j.means)}</p>
        <p class="ready"><b>${ready}</b> of ${fs.length} ready to show</p>
        <div class="chips">${fs.map(chip).join('')}</div>
      </article>`;
      }).join('')}
    </div>
    <div class="arena">
      <div class="arena-head">
        <span class="sticker ink tilt-l">Show-offs</span>
        <h3>Extras to impress the judges</h3>
        <p>Beyond the brief. The line in quotes is what to say on stage.</p>
      </div>
      <ul class="extras">
        ${extras.sort((a, b) => Number(DONE.has(b.status)) - Number(DONE.has(a.status))).map((f) => `
        <li><a href="#f-${esc(f.id)}" data-jump="${esc(f.id)}"><span class="x-status">${STATUS[f.status].icon} ${esc(STATUS[f.status].label)}</span><b>${esc(f.name)}</b>${f.judgeLine ? `<span class="x-line">“${rich(f.judgeLine)}”</span>` : ''}</a></li>`).join('')}
      </ul>
    </div>
  </section>`;

  // ---- screens
  const screens = `
  <section id="screens" aria-labelledby="h-screens">
    <div class="section-head">
      <span class="sticker ink">Screens</span>
      <h2 id="h-screens">How people move between screens</h2>
    </div>
    ${screenMap(data, { STATUS })}
    <div class="table-wrap">
      <table>
        <thead><tr><th scope="col">ID</th><th scope="col">Screen</th><th scope="col">Route</th><th scope="col">Status</th><th scope="col">Feature</th></tr></thead>
        <tbody>
          ${data.screens.map((s) => {
            const f = byId.get(s.feature);
            return `<tr><td class="fid">${esc(s.id)}</td><td>${esc(s.name)}</td><td><code>${esc(s.route)}</code></td><td>${pill(s.status)}</td><td>${f ? `<a href="#f-${esc(f.id)}" data-jump="${esc(f.id)}">${esc(f.name)}</a>` : ''}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </section>`;

  // ---- system
  const system = data.system ? `
  <section id="system" aria-labelledby="h-system">
    <div class="section-head">
      <span class="sticker ink">System architecture</span>
      <h2 id="h-system">What runs where, and what crosses each boundary</h2>
      <p class="muted">Each block is checked against the code on <code>${esc(main.ref)}</code> the same way as a feature part.</p>
    </div>
    ${systemMap(data, { STATUS })}
  </section>` : '';

  // ---- decisions
  const decisions = `
  <section id="decisions" aria-labelledby="h-dec">
    <div class="section-head">
      <span class="sticker ink">Open decisions</span>
      <h2 id="h-dec">Answer these before building the proposals</h2>
      <p class="muted">From <code>docs/PRODUCT-NEXT.md</code>. Each one blocks the features listed under it.</p>
    </div>
    <ol class="decisions">
      ${data.decisions.map((d) => `
      <li class="decision">
        <h3>${esc(d.q)}</h3>
        ${d.detail ? `<p class="muted">${rich(d.detail)}</p>` : ''}
        <div class="dmeta"><span><b>Who</b> ${esc((d.owners ?? []).map((o) => owners[o] ?? o).join(', '))}</span><span class="chips">${(d.blocks ?? []).map((id) => byId.get(id)).filter(Boolean).map(chip).join('')}</span></div>
      </li>`).join('')}
    </ol>
  </section>`;

  // ---- data checks + footer
  const reviewBranches = [...branches.values()].filter(Boolean).filter((b) => b.ahead > 0);
  const checks = `
  <section id="checks" aria-labelledby="h-checks">
    <details${warnings.length ? ' open' : ''}>
      <summary><h2 id="h-checks">Data checks <span class="${warnings.length ? 'warn-count' : 'ok-count'}">${warnings.length ? `${warnings.length} to look at` : '✓ all consistent'}</span></h2></summary>
      ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li>${rich(w)}</li>`).join('')}</ul>` : '<p class="muted">Every part agrees with GitHub and the code.</p>'}
      ${reviewBranches.length ? `<p class="muted small">Branches waiting to merge: ${reviewBranches.map((b) => `<code>${esc(b.name)}</code> (${b.ahead} commits ahead)`).join(', ')}.</p>` : ''}
    </details>
  </section>`;

  const legend = Object.entries(STATUS).map(([k, v]) => `<span class="pill s-${k}" title="${esc(v.hint)}"><span aria-hidden="true">${v.icon}</span>${esc(v.label)}</span>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(data.product.name)} product map</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600..800&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">
<style>
/* Design tokens: generated from tokens.json on ${esc(main.ref)} (Figma "LifeGuessr / Dollhouse"). */
${css}
${STYLES}
${DIAGRAM_STYLES}
</style>
</head>
<body>
<a class="skip" href="#board">Skip to the feature board</a>
<header class="top">
  <nav class="nav" aria-label="Sections">
    <span class="brand">${esc(data.product.name)}</span>
    <a href="#architecture">Architecture</a><a href="#funnel">Funnel</a><a href="#board">Features</a><a href="#judges">Judging</a><a href="#screens">Screens</a><a href="#system">System</a><a href="#decisions">Decisions</a>
  </nav>
</header>
<main>
  <section class="hero" aria-labelledby="h-hero">
    <div class="hero-text">
      <span class="sticker ink">Product map · ${esc(fmtDate(generated))}</span>
      <h1 id="h-hero">What we're building</h1>
      <p class="lede">${esc(data.product.tagline)}</p>
      <p class="meta">Checked against <code>${esc(main.ref)}</code> @ ${repo ? `<a href="${esc(`${repo}/commit/${main.sha}`)}" target="_blank" rel="noopener"><code>${esc(main.sha.slice(0, 7))}</code></a>` : `<code>${esc(main.sha.slice(0, 7))}</code>`}${mainDate ? ` (${esc(fmtDate(mainDate))})` : ''}${issues ? ` and ${issues.size} GitHub issues and pull requests` : ' (GitHub not read)'}.</p>
    </div>
    <div class="hero-arena">
      <span class="sticker ink tilt-l">The pitch</span>
      <p class="arena-quote">${esc(data.product.pitch)}</p>
      <p class="arena-sub">${esc(data.product.thesis)}</p>
      <div class="demo-meter" role="img" aria-label="${demoLive} of ${demo.length} demo-path features live">
        <div class="dm-label"><b>${demoLive}/${demo.length}</b> demo-path features live</div>
        <div class="dm-bar"><span style="width:${demo.length ? (demoLive / demo.length) * 100 : 0}%"></span></div>
      </div>
    </div>
  </section>

  <dl class="scoreboard" aria-label="Features by status">
    ${scoreboard.map((s) => `<div><dt>${esc(s.l)}</dt><dd class="${s.tone ? `t-${s.tone}` : ''}">${s.v}</dd></div>`).join('')}
  </dl>
  <div class="legend" aria-label="Status legend">${legend}</div>

  ${architecture}
  ${funnel}
  ${board}
  ${judging}
  ${screens}
  ${system}
  ${decisions}
  ${checks}
</main>
<footer class="foot">
  <p>Generated by <code>pnpm dashboard</code> from <code>docs/dashboard/features.json</code>, GitHub issues and the code on <code>${esc(main.ref)}</code>. Edit the JSON, not this page; re-run to refresh.</p>
</footer>
<script>
${SCRIPT}
</script>
</body>
</html>
`;
}

// ----- styles (tokens only; mirrors the ui-kit: Card, Sticker, Scoreboard, Button) --------------

const STYLES = String.raw`
*, *::before, *::after { box-sizing: border-box; }
html { color-scheme: light; scroll-behavior: smooth; scroll-padding-top: 72px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } * { transition: none !important; animation: none !important; } }
body { margin: 0; background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); font-size: var(--text-base); line-height: var(--leading-normal); -webkit-font-smoothing: antialiased; }
h1, h2, h3 { font-family: var(--font-display); letter-spacing: -0.01em; margin: 0; line-height: var(--leading-tight); }
h1 { font-weight: var(--font-weight-extrabold); letter-spacing: -0.02em; font-size: var(--text-4xl); line-height: var(--leading-display); }
h2 { font-size: var(--text-3xl); font-weight: var(--font-weight-extrabold); }
h3 { font-size: var(--text-xl); font-weight: var(--font-weight-bold); }
p { margin: 0; }
a { color: inherit; }
code { font-family: var(--font-mono); font-size: 0.85em; background: var(--color-surface-strong); padding: 1px 6px; border-radius: var(--radius-sm); overflow-wrap: anywhere; }
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; border-radius: var(--radius-sm); }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--color-ink); color: var(--color-on-primary); padding: var(--spacing-sm) var(--spacing-md); border-radius: var(--radius-md); z-index: 10; }
.skip:focus { left: 16px; }
.muted { color: var(--color-text-muted); }
.small { font-size: var(--text-sm); }

main, .nav, .foot { max-width: 1240px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 640px) { main, .nav, .foot { padding: 0 var(--spacing-xl); } }
main > section { margin-top: var(--spacing-3xl); }
.section-head { display: flex; flex-direction: column; gap: var(--spacing-md); margin-bottom: var(--spacing-xl); max-width: 860px; }

.top { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--color-bg) 88%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--color-border); }
.nav { display: flex; gap: var(--spacing-lg); align-items: center; height: 56px; overflow-x: auto; scrollbar-width: none; font-size: var(--text-sm); font-weight: var(--font-weight-bold); }
.nav a { text-decoration: none; color: var(--color-text-muted); white-space: nowrap; padding: var(--spacing-sm) 0; }
.nav a:hover { color: var(--color-primary); }
.brand { font-family: var(--font-display); font-weight: var(--font-weight-extrabold); font-size: var(--text-xl); margin-right: var(--spacing-sm); white-space: nowrap; }

.sticker { display: inline-flex; width: fit-content; align-items: center; gap: var(--spacing-xs); border-radius: var(--radius-full); padding: var(--spacing-xs) var(--spacing-md); font-size: var(--text-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.5; }
.sticker.ink { background: var(--color-ink); color: var(--color-on-primary); }
.sticker.primary { background: var(--color-primary); color: var(--color-on-primary); }
.sticker.soft { background: var(--color-primary-soft); color: var(--color-primary-hover); }
.tilt { transform: rotate(4deg); }
.tilt-l { transform: rotate(-4deg); }

/* Hero */
.hero { display: grid; gap: var(--spacing-xl); margin-top: var(--spacing-2xl); align-items: stretch; }
@media (min-width: 900px) { .hero { grid-template-columns: 1.1fr 1fr; } h1 { font-size: var(--text-display); } }
.hero-text { display: flex; flex-direction: column; gap: var(--spacing-lg); justify-content: center; }
.lede { font-size: var(--text-xl); color: var(--color-text-muted); max-width: 40ch; }
.meta { font-size: var(--text-sm); color: var(--color-text-muted); }
.hero-arena { background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-xl); padding: var(--spacing-xl); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: var(--spacing-md); }
.arena-quote { font-family: var(--font-display); font-weight: var(--font-weight-extrabold); font-size: var(--text-2xl); line-height: var(--leading-tight); }
.arena-sub { opacity: 0.9; }
.demo-meter { margin-top: auto; padding-top: var(--spacing-md); }
.dm-label { font-size: var(--text-sm); margin-bottom: var(--spacing-xs); }
.dm-label b { font-family: var(--font-display); font-size: var(--text-2xl); margin-right: 4px; }
.dm-bar { height: 12px; background: rgb(255 255 255 / 0.3); border-radius: var(--radius-full); overflow: hidden; }
.dm-bar span { display: block; height: 100%; background: var(--color-ink); border-radius: var(--radius-full); }

/* Scoreboard (ui-kit Scoreboard) */
.scoreboard { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--spacing-lg) var(--spacing-xl); background: var(--color-ink); border-radius: var(--radius-xl); padding: var(--spacing-lg) var(--spacing-xl); margin: var(--spacing-xl) 0 0; }
@media (min-width: 640px) { .scoreboard { grid-template-columns: repeat(5, minmax(0, 1fr)); padding: var(--spacing-lg) var(--spacing-2xl); } }
.scoreboard div { display: flex; flex-direction: column-reverse; gap: var(--spacing-xs); min-width: 0; }
.scoreboard dt { font-size: var(--text-sm); color: rgb(255 255 255 / 0.6); }
.scoreboard dd { margin: 0; font-family: var(--font-display); font-weight: var(--font-weight-extrabold); font-size: var(--text-4xl); line-height: var(--leading-tight); color: var(--color-on-primary); font-variant-numeric: tabular-nums; }
.scoreboard .t-positive { color: var(--color-positive); }
.scoreboard .t-primary { color: var(--color-primary); }
.scoreboard .t-blue { color: var(--color-chart-1); }
.legend { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); margin-top: var(--spacing-md); }

/* Status pills: icon + word, never color alone */
.pill { display: inline-flex; align-items: center; gap: 5px; border-radius: var(--radius-full); padding: 2px 10px; font-size: var(--text-xs); font-weight: var(--font-weight-bold); white-space: nowrap; border: 1.5px solid transparent; line-height: 1.6; }
.s-live.pill { background: var(--color-positive-soft); color: #13774a; }
.s-preview.pill { background: var(--color-surface-strong); color: var(--color-text); border-color: var(--color-text); }
.s-polish.pill { background: var(--color-positive-soft); color: #13774a; border-color: var(--color-positive); border-style: dashed; }
.s-review.pill { background: #e4ecfd; color: #2b5cc4; }
.s-building.pill { background: #fdf0d3; color: #8a5a00; }
.s-todo.pill { background: var(--color-surface); color: var(--color-text-muted); border-color: var(--color-border); }
.s-idea.pill { background: transparent; color: var(--color-text-muted); border-color: var(--color-text-muted); border-style: dashed; }
.s-check.pill { background: #fbe2de; color: var(--color-negative); }

/* Chips (feature links) */
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 12px 4px 8px; border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: var(--font-weight-medium); text-decoration: none; background: var(--color-surface); border: 1.5px solid var(--color-border); transition: transform .12s ease, border-color .12s ease; }
.chip:hover { transform: translateY(-1px); border-color: var(--color-text); }
.chip-icon { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: var(--font-weight-bold); }
.chip.s-live .chip-icon, .chip.s-polish .chip-icon { background: var(--color-positive); color: #fff; }
.chip.s-preview .chip-icon { background: var(--color-ink); color: #fff; }
.chip.s-review .chip-icon { background: var(--color-chart-1); color: #fff; }
.chip.s-building .chip-icon { background: var(--color-warning); color: var(--color-ink); }
.chip.s-todo .chip-icon { background: var(--color-surface-strong); color: var(--color-text-muted); }
.chip.s-idea { border-style: dashed; background: transparent; }
.chip.s-idea .chip-icon { color: var(--color-text-muted); font-size: 15px; }
.chip.s-check .chip-icon { background: var(--color-negative); color: #fff; }

/* Funnel */
.stages { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; position: relative; }
.stage { display: grid; grid-template-columns: 44px 1fr; gap: var(--spacing-md) var(--spacing-lg); padding: var(--spacing-lg) 0; position: relative; }
.stage + .stage { border-top: 1px dashed var(--color-border); }
@media (min-width: 900px) { .stage { grid-template-columns: 44px 1fr 340px; } }
.stage::before { content: ""; position: absolute; left: 21px; top: 0; bottom: 0; width: 2px; background: var(--color-border); z-index: 0; }
.stage:first-child::before { top: 36px; }
.stage:last-child::before { bottom: calc(100% - 36px); }
.stage-no { position: relative; z-index: 1; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--color-surface); border: 2px solid var(--color-text); font-family: var(--font-display); font-weight: var(--font-weight-extrabold); font-size: var(--text-lg); }
.stage.loop .stage-no { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); }
.stage-body { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; }
.stage-title { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: baseline; }
.screens { font-size: var(--text-xs); font-weight: var(--font-weight-bold); color: var(--color-text-muted); background: var(--color-surface-strong); border-radius: var(--radius-full); padding: 1px 8px; }
.stage-events { grid-column: 2; display: flex; flex-direction: column; gap: var(--spacing-sm); }
@media (min-width: 900px) { .stage-events { grid-column: 3; } }
.event { background: var(--color-surface); border-radius: var(--radius-md); padding: var(--spacing-sm) var(--spacing-md); font-size: var(--text-sm); box-shadow: var(--shadow-sm); }
.tracked { color: #13774a; font-weight: var(--font-weight-bold); font-size: var(--text-xs); }
.untracked { color: var(--color-text-muted); font-weight: var(--font-weight-bold); font-size: var(--text-xs); }
code.untracked { text-decoration: line-through; }
.bar { height: 10px; background: var(--color-surface-strong); border-radius: var(--radius-full); overflow: hidden; margin-top: 6px; }
.bar span { display: block; height: 100%; background: var(--color-primary); border-radius: var(--radius-full); }
.bar-nums { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
.bar-nums b { color: var(--color-text); }

/* Feature board */
.filters { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; padding: var(--spacing-md) 0; background: var(--color-bg); border-bottom: 1px solid var(--color-border); margin-bottom: var(--spacing-lg); }
@media (min-width: 900px) { .filters { position: sticky; top: 56px; z-index: 4; } }
.seg { display: inline-flex; flex-wrap: wrap; background: var(--color-surface-strong); border-radius: var(--radius-lg); padding: 3px; gap: 2px; }
.seg button { font: inherit; font-size: var(--text-sm); font-weight: var(--font-weight-bold); border: 0; background: transparent; color: var(--color-text-muted); padding: 6px 12px; border-radius: var(--radius-md); cursor: pointer; min-height: 36px; }
.seg button[aria-checked="true"] { background: var(--color-ink); color: var(--color-on-primary); }
.seg button:hover:not([aria-checked="true"]) { color: var(--color-text); }
.select select, .search input { font: inherit; font-size: var(--text-sm); border: 2px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-lg); padding: 7px 12px; min-height: 40px; color: var(--color-text); }
.search { flex: 1 1 220px; }
.search input { width: 100%; }
.select select:focus, .search input:focus { outline: none; border-color: var(--color-primary); }
.count { font-size: var(--text-sm); color: var(--color-text-muted); font-weight: var(--font-weight-bold); }
.board-group { margin-bottom: var(--spacing-2xl); }
.group-title { margin-bottom: var(--spacing-md); font-size: var(--text-2xl); }
.group-title .muted { font-family: var(--font-sans); font-size: var(--text-base); font-weight: var(--font-weight-medium); }
.grid { display: grid; gap: var(--spacing-lg); grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
.fcard { background: var(--color-surface); border-radius: var(--radius-xl); padding: var(--spacing-xl); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; border: 2px solid transparent; transition: border-color .2s ease, box-shadow .2s ease; }
.fcard[data-status="idea"] { background: transparent; box-shadow: none; border: 2px dashed var(--color-border); }
.fcard.flash { border-color: var(--color-primary); box-shadow: 0 0 0 6px var(--color-primary-soft), var(--shadow-md); }
.fcard-top { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
.fid { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: var(--font-weight-bold); color: var(--color-text-muted); }
.demo-tag { font-size: var(--text-xs); font-weight: var(--font-weight-bold); color: var(--color-primary-hover); }
.pitch { color: var(--color-text-muted); font-size: var(--text-sm); }
.progress { height: 8px; background: var(--color-surface-strong); border-radius: var(--radius-full); overflow: hidden; }
.progress span { display: block; height: 100%; background: var(--color-positive); border-radius: var(--radius-full); }
.progress-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: -6px; }
.parts { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--spacing-sm); font-size: var(--text-sm); }
.part { display: grid; grid-template-columns: 22px 1fr; gap: var(--spacing-sm); align-items: start; }
.part-icon { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: var(--font-weight-bold); margin-top: 1px; }
.part.s-live .part-icon, .part.s-polish .part-icon { background: var(--color-positive); color: #fff; }
.part.s-preview .part-icon { background: var(--color-ink); color: #fff; }
.part.s-review .part-icon { background: var(--color-chart-1); color: #fff; }
.part.s-building .part-icon { background: var(--color-warning); color: var(--color-ink); }
.part.s-todo .part-icon { background: var(--color-surface-strong); color: var(--color-text-muted); border: 1.5px solid var(--color-border); }
.part.s-idea .part-icon { border: 1.5px dashed var(--color-text-muted); color: var(--color-text-muted); font-size: 13px; }
.part.s-check .part-icon { background: var(--color-negative); color: #fff; }
.part.later { opacity: 0.7; }
.part-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 3px; align-items: center; }
.part-note { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 3px; }
.tag-later { display: inline-block; font-size: 10px; font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: .05em; border: 1px dashed var(--color-text-muted); color: var(--color-text-muted); border-radius: var(--radius-full); padding: 0 6px; vertical-align: 1px; }
.iss { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: var(--font-weight-bold); border-radius: var(--radius-full); padding: 0 7px; }
.iss-closed { background: #ece5fb; color: #6a3fc2; }
.iss-open { background: var(--color-positive-soft); color: #13774a; }
.iss-unknown { background: var(--color-surface-strong); color: var(--color-text-muted); }
a:has(> .iss) { text-decoration: none; }
.branch { font-family: var(--font-mono); font-size: var(--text-xs); color: #2b5cc4; background: #e4ecfd; border-radius: var(--radius-full); padding: 0 7px; }
.judge-line { background: var(--color-primary-soft); border-radius: var(--radius-md); padding: var(--spacing-sm) var(--spacing-md); font-size: var(--text-sm); font-weight: var(--font-weight-medium); color: var(--color-ink); }
.fmeta { display: flex; flex-wrap: wrap; gap: 4px var(--spacing-md); font-size: var(--text-xs); color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: var(--spacing-md); margin-top: auto; }
.fmeta b { color: var(--color-text); font-weight: var(--font-weight-bold); margin-right: 2px; }

/* Judging */
.judge-grid { display: grid; gap: var(--spacing-lg); grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
.judge-card { background: var(--color-surface); border-radius: var(--radius-xl); padding: var(--spacing-xl); box-shadow: var(--shadow-md); display: flex; flex-direction: column; gap: var(--spacing-sm); }
.judge-weight { display: flex; align-items: center; gap: var(--spacing-md); }
.weight { font-family: var(--font-display); font-weight: var(--font-weight-extrabold); font-size: var(--text-4xl); color: var(--color-primary); line-height: 1; }
.wbar { flex: 1; height: 8px; background: var(--color-surface-strong); border-radius: var(--radius-full); overflow: hidden; }
.wbar span { display: block; height: 100%; background: var(--color-primary); }
.ready { font-size: var(--text-sm); }
.ready b { font-family: var(--font-display); font-size: var(--text-xl); }
.arena { margin-top: var(--spacing-xl); background: var(--color-primary); color: var(--color-on-primary); border-radius: var(--radius-xl); padding: var(--spacing-xl); box-shadow: var(--shadow-lg); }
@media (min-width: 640px) { .arena { padding: var(--spacing-2xl); } }
.arena-head { display: flex; flex-direction: column; gap: var(--spacing-sm); margin-bottom: var(--spacing-lg); }
.arena-head h3 { font-size: var(--text-3xl); font-weight: var(--font-weight-extrabold); }
.extras { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--spacing-md); grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
.extras a { display: flex; flex-direction: column; gap: 4px; height: 100%; text-decoration: none; background: rgb(255 255 255 / 0.12); border-radius: var(--radius-lg); padding: var(--spacing-md) var(--spacing-lg); transition: background .12s ease; }
.extras a:hover { background: rgb(255 255 255 / 0.2); }
.extras b { font-family: var(--font-display); font-size: var(--text-lg); }
.x-status { font-size: var(--text-xs); font-weight: var(--font-weight-bold); text-transform: uppercase; letter-spacing: .04em; opacity: .9; }
.x-line { font-size: var(--text-sm); opacity: .92; }

/* Screens table */
.table-wrap { overflow-x: auto; background: var(--color-surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); }
table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); min-width: 640px; }
th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-muted); padding: var(--spacing-md) var(--spacing-lg); border-bottom: 2px solid var(--color-border); }
td { padding: var(--spacing-sm) var(--spacing-lg); border-bottom: 1px solid var(--color-border); vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
td a { font-weight: var(--font-weight-medium); }

/* Decisions */
.decisions { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--spacing-md); grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); counter-reset: d; }
.decision { counter-increment: d; background: var(--color-surface-strong); border-radius: var(--radius-xl); padding: var(--spacing-lg) var(--spacing-xl); display: flex; flex-direction: column; gap: var(--spacing-sm); }
.decision h3 { font-size: var(--text-lg); }
.decision h3::before { content: counter(d) ". "; color: var(--color-primary); }
.decision p { font-size: var(--text-sm); }
.dmeta { display: flex; flex-direction: column; gap: var(--spacing-sm); font-size: var(--text-xs); color: var(--color-text-muted); margin-top: auto; }
.dmeta b { color: var(--color-text); }
.dmeta .chip { min-height: 28px; font-size: var(--text-xs); }

/* Checks + footer */
#checks details { background: var(--color-surface); border-radius: var(--radius-xl); padding: var(--spacing-lg) var(--spacing-xl); box-shadow: var(--shadow-sm); }
#checks summary { cursor: pointer; list-style: none; }
#checks summary::-webkit-details-marker { display: none; }
#checks h2 { font-size: var(--text-xl); display: inline-flex; flex-wrap: wrap; gap: var(--spacing-sm); align-items: center; }
#checks h2::before { content: "▸"; color: var(--color-text-muted); }
#checks details[open] h2::before { content: "▾"; }
.warn-count { font-family: var(--font-sans); font-size: var(--text-xs); background: #fbe2de; color: var(--color-negative); border-radius: var(--radius-full); padding: 2px 10px; }
.ok-count { font-family: var(--font-sans); font-size: var(--text-xs); background: var(--color-positive-soft); color: #13774a; border-radius: var(--radius-full); padding: 2px 10px; }
.warnings { margin: var(--spacing-md) 0; padding-left: 1.2em; font-size: var(--text-sm); display: flex; flex-direction: column; gap: 4px; }
.foot { margin-top: var(--spacing-3xl); padding-top: var(--spacing-lg); padding-bottom: var(--spacing-3xl); border-top: 1px solid var(--color-border); font-size: var(--text-sm); color: var(--color-text-muted); }
`;

// ----- client script: filters and jump-to-feature (works without it; this only filters) ---------

const SCRIPT = String.raw`
(() => {
  const state = { status: 'all', tier: 'all', owner: 'all', q: '' };
  const cards = [...document.querySelectorAll('.fcard')];
  const groups = [...document.querySelectorAll('.board-group')];
  const count = document.querySelector('.count');
  const empty = document.querySelector('#board .empty');
  const DONE = ['live', 'preview', 'polish'];

  const matches = (c) => {
    const s = c.dataset.status;
    if (state.status === 'done' && !DONE.includes(s)) return false;
    if (state.status === 'building' && s !== 'building' && s !== 'check') return false;
    if (!['all', 'done', 'building'].includes(state.status) && s !== state.status) return false;
    if (state.tier === 'demo' && c.dataset.demo !== '1') return false;
    if (['extra', 'next'].includes(state.tier) && c.dataset.tier !== state.tier) return false;
    if (state.owner !== 'all' && !c.dataset.owners.split(' ').includes(state.owner)) return false;
    if (state.q && !c.dataset.text.includes(state.q)) return false;
    return true;
  };

  const apply = () => {
    let shown = 0;
    for (const c of cards) { const ok = matches(c); c.hidden = !ok; if (ok) shown++; }
    for (const g of groups) g.hidden = !g.querySelector('.fcard:not([hidden])');
    count.textContent = shown + ' of ' + cards.length;
    empty.hidden = shown > 0;
  };

  for (const seg of document.querySelectorAll('.seg')) {
    const buttons = [...seg.querySelectorAll('button')];
    const select = (b) => {
      for (const x of buttons) x.setAttribute('aria-checked', String(x === b));
      state[seg.dataset.filter] = b.dataset.value;
      apply();
    };
    buttons.forEach((b, i) => {
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', () => select(b));
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const next = buttons[(i + d + buttons.length) % buttons.length];
        buttons.forEach((x) => (x.tabIndex = x === next ? 0 : -1));
        next.focus();
        select(next);
      });
    });
  }
  document.querySelector('[data-filter="owner"]').addEventListener('change', (e) => { state.owner = e.target.value; apply(); });
  document.querySelector('[data-filter="q"]').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); apply(); });

  const reset = () => {
    Object.assign(state, { status: 'all', tier: 'all', owner: 'all', q: '' });
    for (const seg of document.querySelectorAll('.seg')) seg.querySelectorAll('button').forEach((b, i) => { b.setAttribute('aria-checked', String(i === 0)); b.tabIndex = i === 0 ? 0 : -1; });
    document.querySelector('[data-filter="owner"]').value = 'all';
    document.querySelector('[data-filter="q"]').value = '';
    apply();
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-jump]');
    if (!link) return;
    const card = document.getElementById('f-' + link.dataset.jump);
    if (!card) return;
    e.preventDefault();
    if (card.hidden) reset();
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    history.replaceState(null, '', '#f-' + link.dataset.jump);
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash');
    setTimeout(() => card.classList.remove('flash'), 1800);
  });

  apply();
})();
`;

build();
