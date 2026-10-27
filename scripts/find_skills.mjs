#!/usr/bin/env node
// Skill router indexer: scans every installed SKILL.md, scores it against a
// plain-language query, prints the best matches with paths.
//
//   node find_skills.mjs "build a landing page" --limit 8
//   node find_skills.mjs "quest hand tracking" --explain   # show why it ranked
//   node find_skills.mjs --all            # dump the full catalog
//   node find_skills.mjs --name pdf       # print just the path for an exact name
//
// Cheap by design: one process, no network, no model. Run it before guessing.
//
// Scoring is lexical base + concept boosts:
//   1. IDF-weighted token match over name and description (rare words win)
//   2. coverage factor — matching 3 of 4 content words beats matching 1 of 1
//   3. CONCEPTS — curated intent rules for phrasings that share no words with the
//      skill they need ("vague idea, no spec" → brainstorming)
//   4. GATES — platform-specific skills collapse when the platform is not named
// Regression-test any change with scripts/eval_routing.mjs.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const CWD = process.cwd();

// Where skill directories are looked for. Order matters: earlier roots win when the
// same skill name appears twice (a user-level copy should beat a plugin copy).
// `SKILL_ROUTER_ROOTS` (path-delimited) replaces the whole list, which is how you
// point this at an environment it has never seen:
//   SKILL_ROUTER_ROOTS=/opt/team/skills:/home/me/.claude/skills node find_skills.mjs ...
// Every root is optional; a machine with none of them reports 0 skills instead of
// failing, so the tool is safe to run anywhere.
const ENV_ROOTS = (process.env.SKILL_ROUTER_ROOTS || "")
  .split(path.delimiter)
  .map((r) => r.trim())
  .filter(Boolean);

const DEFAULT_ROOTS = [
  // per-user skill dirs across harnesses
  path.join(HOME, ".pi", "agent", "skills"),
  path.join(HOME, ".claude", "skills"),
  path.join(HOME, ".codex", "skills"),
  path.join(HOME, ".agents", "skills"),
  path.join(HOME, ".config", "agents", "skills"),
  path.join(HOME, ".cursor", "skills"),
  path.join(HOME, ".copilot", "skills"),
  path.join(HOME, "skills"),
  // plugin / package installs that ship skills inside node_modules
  path.join(HOME, ".pi", "agent", "npm", "node_modules"),
  path.join(HOME, ".claude", "plugins"),
  // project-local skill dirs
  path.join(CWD, ".agents", "skills"),
  path.join(CWD, ".claude", "skills"),
  path.join(CWD, ".pi", "skills"),
  path.join(CWD, ".codex", "skills"),
  path.join(CWD, "skills"),
];

const ROOTS = ENV_ROOTS.length ? ENV_ROOTS : DEFAULT_ROOTS;

// Function words and filler. Kept short on purpose: anything contentless that is
// not here gets caught by IDF instead, which is corpus-driven and needs no upkeep.
const STOP = new Set(
  "a an the and or but if then than that this these those i me my we our you your he she it its of to in on at for with without from by as is are was were be been being do does did done can could should would will not no yes need wants want help make made get got give please some any all more most very just also how what when where which who why use using used skill skills task thing things work works working one two new best good user users like micro".split(
    /\s+/,
  ),
);

// Verbs of intent, not subject matter. Demoted because every request contains
// them, so matching one says "this is work", not "this is the skill". Deliberately
// excludes debug / test / deploy / review / refactor — those name whole skills.
const GENERIC = new Set(
  "build building write writing create creating implement implementing design designing add adding edit editing change changing update updating setup set fix fixing run running check checking".split(
    /\s+/,
  ),
);

// Skills that only make sense when the task names their platform. Without this,
// "debug my react app" ranks a Quest profiler above every debugging skill because
// both say debug and render.
// Ecosystem gates: skills that only make sense when the task names their platform.
// These are OPTIONAL hints for ecosystems the author knows; the portable mechanism
// is the lexical-confidence gate in score(), which needs no names at all. In an
// environment with none of these skills, this table is dead weight and harmless.
// Add your own with `gates.local.json` rather than editing this file.
const GATES = [
  {
    names: ["hz-", "metavr"],
    need: ["quest", "vr", "xr", "headset", "meta", "horizon", "unity", "spatial", "passthrough", "oculus", "perfetto", "immersive"],
  },
  { names: ["portal"], need: ["portal", "tabletop", "smart camera"] },
  { names: ["cloudbase"], need: ["cloudbase", "腾讯", "tcb", "wechat", "小程序", "微信"] },
  {
    names: ["kimi-webbridge"],
    need: ["browser", "webbridge", "site", "website", "url", "logged in", "page"],
  },
  {
    names: ["kimi-cu"],
    need: ["windows", "desktop", "gui", "click", "screenshot", "office", "excel", "word", "app window"],
  },
  // Self-hosted Vercel-only products: fine to surface on their own words, but
  // they must not win generic "deploy"/"cache" phrasing against the broad skill.
  { names: ["tencent", "weixin"], need: ["tencent"] },
];

// intent → skill. `when` is matched against the raw lowercased query. Boosts are
// additive points (roughly: 4 = clearly relevant, 8 = this is the answer).
// `unless` vetoes the rule; `demote` multiplies the named skills instead.
const CONCEPTS = [
  {
    when: /\b(what('s| is| are) (this|it) called|what do you call|name (of|for) (this|that)|term for)\b/,
    boost: { "animation-vocabulary": 10 },
  },
  {
    when: /\b(animate|animated|animation|motion|bounce|slide|fade|pop ?in|spring|wiggle|ease|keyframes|micro ?interaction|hover effect|transition)\b/,
    unless: /\b(audit|review|scan|codebase|find)\b/,
    boost: { animate: 6, "animate-expo": 2, "vercel-react-view-transitions": 2 },
  },
  {
    when: /\b(audit|review|scan|survey|find|missing|improve|lacking)\b.*\b(animation|animations|motion|transition|interaction|interactions|micro[- ]?interaction)/,
    boost: { "improve-animations": 8, "find-animation-opportunities": 8, animate: 2 },
  },
  { when: /\b(should|which|what)\b.*\b(animat|feel alive|more dynamic)\b/, boost: { animate: 6 } },
  { when: /\b(react native|expo|ios app|android app|swipe|gesture)\b/, boost: { "animate-expo": 4 } },
  {
    when: /\b(font|fonts|typeface|typography|kerning|tracking|leading|line ?height|font pairing|letter ?spacing)\b/,
    boost: { typeset: 7 },
  },
  {
    when: /\b(palette|colou?r|accent|hue|too many colou?rs|colou?r scheme)\b/,
    boost: { colorize: 5 },
  },
  {
    when: /\b(accessib\w*|a11y|contrast|aria|screen ?reader|keyboard nav)\b/,
    boost: { "web-design-guidelines": 6, critique: 2 },
  },
  {
    when: /\b(review|audit|critique|check)\b.*\b(ui|design|screen|page|interface|layout)\b/,
    boost: { "web-design-guidelines": 4, critique: 4 },
  },
  {
    when: /\b(vague|no (spec|idea|clue)|where do i (start|begin)|not sure what to build|brainstorm|idea for|explore options)\b/,
    boost: { brainstorming: 9 },
  },
  {
    when: /\b(plan|roadmap|break (this|it) (down|into)|task list|milestones)\b/,
    boost: { "writing-plans": 5, "executing-plans": 2 },
  },
  {
    when: /\b(is (it|this) (actually )?(done|finished|working)|am i (fooling|kidding) myself|before i (ship|claim|submit)|double ?check .*(work|done)|did it (work|actually run)|prove it works)\b/,
    boost: { "verification-before-completion": 7, "verification-loop": 4, verification: 4 },
  },
  {
    when: /\b(should i|help me decide|worth it|decide between|go\/no[- ]go|stress[- ]test (this|the) (decision|plan|idea)|big decision)\b/,
    boost: { council: 6, "council-mode": 4 },
  },
  {
    when: /\b(we decided|last time|remember (when|that|what)|earlier session|my (college|university|startup|school plan)|scholarship|admission|visa|application deadline)\b/,
    boost: { "memory-mnemon": 9 },
  },
  {
    when: /\b((new|write|create|make|build|fix|improve|edit)\b.*\bskill\b|skill (authoring|creation|library)|author a skill)\b/,
    boost: { "skill-creator": 8, "writing-skills": 7 },
  },
  {
    when: /\b(review|check|read)\b.*\b(pr|pull request|diff|patch)\b/,
    boost: { "requesting-code-review": 6, "dsh-code-review": 5, "receiving-code-review": 3 },
  },
  {
    when: /\b(modal|dialog|tooltip|popover|dropdown|combobox|date ?picker|autocomplete|accordion|tabs|carousel|form validation|input mask|z-?index|stacking context|toast)\b/,
    boost: { "modern-web-guidance": 6, shadcn: 4, "frontend-patterns": 3, "ui-craft": 2 },
  },
  {
    when: /\b(useeffect|usestate|use ?memo|re-?render|rerender|stale (state|closure)|hooks?|out of sync|infinite loop|hydration (error|mismatch)|state management)\b/,
    boost: { "frontend-patterns": 6, "react-best-practices": 5, "systematic-debugging": 2 },
  },
  {
    when: /\b(windows (app|application|desktop)|desktop app|gui app|excel|click through the app)\b/,
    boost: { "kimi-cu": 7 },
  },
  {
    when: /\b(logged in|my browser|real browser|my account|screenshot (the|this|that) (site|page)|fill in .*(form|site))\b/,
    boost: { "kimi-webbridge": 6 },
  },
  { when: /\b(gif|screen ?recording|demo (gif|video))\b/, boost: { "record-browser-gif": 7 } },
  {
    when: /\b(data[- ]dense|bloomberg|retool|admin (panel|table|console)|analytics (table|dashboard)|dense table|mono ?space numbers)\b/,
    boost: { "ui-craft-dense-dashboard": 8 },
  },
  {
    when: /\bdashboard\b/,
    unless: /\b(data[- ]dense|admin|analytics|retool|bloomberg)\b/,
    boost: { "ui-craft": 6 },
    demote: { "ui-craft-dense-dashboard": 0.3 },
  },
  {
    when: /\b(blob|file upload|image upload|object storage|redis|kv store|edge config|persistent cache)\b/,
    boost: { "vercel-storage": 6 },
  },
  { when: /\b(domain|dns|nameserver|registrar|whois)\b/, boost: { domains: 6 } },
  {
    when: /\b(spreadsheet|excel file|xlsx|csv|formula|pivot|worksheet)\b/,
    boost: { xlsx: 5 },
  },
  {
    when: /\b(pitch|fundrais\w+|raise|investor|seed|pre-seed|valuation|cap table)\b/,
    boost: { "investor-materials": 8, pptx: 3 },
  },
  { when: /\b(deck|slides|presentation)\b/, boost: { pptx: 4, "frontend-slides": 3 } },
  { when: /\b(word doc\w*|docx|\.docx|memo|letter)\b/, boost: { docx: 5 } },
  { when: /\bpdf\b/, boost: { pdf: 7 } },
  {
    when: /\b(broken|not working|throws?|crash\w*|blank screen|fails?|failing|regression|unexpected behaviou?r|stuck)\b/,
    unless: /\b(test|spec|suite|playwright|cypress)\b/,
    boost: { "systematic-debugging": 5 },
  },
  {
    when: /\b(flaky|randomly fail\w*|e2e|selenium|cypress)\b/,
    boost: { "e2e-testing": 6, "playwright-cli": 4, "systematic-debugging": 2 },
  },
  {
    when: /\b(why (is|does) (it|this)|intermittent|race condition|deadlock|memory leak|nondeterministic)\b/,
    boost: { "systematic-debugging": 6 },
  },
  {
    when: /\b(tools? and (memory|state)|agent loop|autonomous agent|multi[- ]agent)\b/,
    boost: { "build-agents": 7 },
  },
  {
    when: /\b(vercel)\b/,
    boost: { "vercel-cli": 3, "deployments-cicd": 2 },
  },
];

// Private overlay: `concepts.local.json` beside this script adds site-specific rules
// (your own project names, internal tool routing) without putting them in the repo.
// Format: [{ "when": "regex", "boost": { "skill-name": 8 }, "demote": { ... } }]
// Absent file = no-op, which is the case for a fresh clone.
(function loadLocalConcepts() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, "concepts.local.json");
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  let rules;
  try {
    rules = JSON.parse(raw);
  } catch (e) {
    console.error(`ignoring malformed ${path.basename(file)}: ${e.message}`);
    return;
  }
  if (!Array.isArray(rules)) return;
  for (const r of rules) {
    if (!r || typeof r.when !== "string") continue;
    try {
      CONCEPTS.push({
        when: new RegExp(r.when, r.flags || "i"),
        unless: r.unless ? new RegExp(r.unless, r.flags || "i") : undefined,
        boost: r.boost,
        demote: r.demote,
      });
    } catch (e) {
      console.error(`ignoring bad rule in ${path.basename(file)}: ${e.message}`);
    }
  }
})();

// Author-curated family demotions: duplicates that must never outrank the copy the
// routing table points at. xlsx-dsh stays available (deeper analysis), just second.
const DEMOTE = {
  "impeccable-dsh": 0.25,
  "xlsx-dsh": 0.55,
  "dsh-code-review": 0.9,
  "model-only-skill": 0.1,
  "snapshot-skill": 0.1,
  "dsh-test-infra": 0.1,
};

const args = process.argv.slice(2);
const flags = {};
const words = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--all") flags.all = true;
  else if (a === "--json") flags.json = true;
  else if (a === "--explain") flags.explain = true;
  else if (a === "--doctor") flags.doctor = true;
  else if (a === "--root") (flags.roots = flags.roots || []).push(args[++i] || "");
  else if (a === "--limit" || a === "-n") flags.limit = Number(args[++i]) || 8;
  else if (a === "--name") flags.name = (args[++i] || "").toLowerCase();
  else words.push(a);
}
const query = words.join(" ");
const limit = flags.limit || 8;

// --root wins over $SKILL_ROUTER_ROOTS, which wins over the built-in defaults.
const ACTIVE_ROOTS = (flags.roots && flags.roots.filter(Boolean).length
  ? flags.roots.filter(Boolean)
  : ROOTS
).map((r) => path.resolve(r.replace(/^~(?=$|[\\/])/, HOME)));
const lowerQuery = query.toLowerCase();

function walk(dir, out, depth = 0) {
  if (depth > 6) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === "node_modules" && depth > 0) continue;
    if (e.name === "references" || e.name === "assets" || e.name === "scripts" || e.name === "evals") continue;
    if (e.name.startsWith(".") && e.name !== ".agents" && e.name !== ".pi") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out, depth + 1);
    else if (e.name === "SKILL.md") out.push(full);
  }
}

// Reads only the frontmatter block, so 180 skills stay cheap to index. Some
// skills carry multi-KB metadata arrays, so read in chunks until the closing
// delimiter instead of assuming the block fits in one buffer.
const FM_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/;
function readFrontmatter(file) {
  let fd;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return null;
  }
  try {
    let acc = "";
    const buf = Buffer.alloc(8192);
    let pos = 0;
    while (acc.length < 512 * 1024) {
      const n = fs.readSync(fd, buf, 0, 8192, pos);
      if (!n) break;
      acc += buf.subarray(0, n).toString("utf8");
      pos += n;
      if (acc.length > 4 && FM_RE.test(acc)) break;
    }
    return acc;
  } finally {
    fs.closeSync(fd);
  }
}

function parseSkill(file) {
  const head = readFrontmatter(file);
  if (!head) return null;
  const m = head.match(FM_RE);
  if (!m) return null;
  const lines = m[1].split(/\r?\n/);
  const fm = {};
  let key = null;
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (/^[>|][-+]?$/.test(v)) v = "";
      fm[key] = v.replace(/^["']|["']$/g, "");
    } else if (key && /^\s+\S/.test(line)) {
      fm[key] = (fm[key] ? fm[key] + " " : "") + line.trim();
    }
  }
  if (!fm.name || !fm.description) return null;
  return {
    name: fm.name.trim().toLowerCase(),
    description: fm.description.replace(/\s+/g, " ").trim(),
    hidden: String(fm["disable-model-invocation"]).toLowerCase() === "true",
    dir: path.dirname(file),
    file,
  };
}

const files = [];
for (const root of ACTIVE_ROOTS) walk(root, files);
const seenPath = new Set();
const seenName = new Map();
const skills = [];
const duplicates = [];
const unparsable = [];
for (const f of files) {
  const real = path.resolve(f);
  if (seenPath.has(real)) continue;
  seenPath.add(real);
  const s = parseSkill(real);
  if (!s) {
    unparsable.push(real);
    continue;
  }
  // Same skill name in two roots (user copy + plugin copy). First root wins; the
  // loser is reported by --doctor instead of silently scoring both.
  const prior = seenName.get(s.name);
  if (prior) {
    duplicates.push({ name: s.name, kept: prior.file, dropped: s.file });
    continue;
  }
  seenName.set(s.name, s);
  skills.push(s);
}
skills.sort((a, b) => a.name.localeCompare(b.name));

function tokens(s) {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .filter((t) => t.length > 2)
    .map((t) => (t.length > 4 && t.endsWith("s") && !t.endsWith("ss") ? t.slice(0, -1) : t));
}

// Precompute token sets once; the same skill is scored many times per run.
for (const s of skills) {
  s.nameTokens = [...new Set(tokens(s.name.replace(/-/g, " ")))];
  s.nameSet = new Set(s.nameTokens);
  s.descTokens = [...new Set(tokens(s.description))];
  s.descSet = new Set(s.descTokens);
  s.descLower = s.description.toLowerCase();
}

// IDF over the catalog: a word in 150 descriptions ("user", "when", "code") is
// noise; a word in 2 ("perfetto", "kerning") is nearly a skill name. This is what
// stops long descriptions from winning by surface area alone.
const documentFrequency = new Map();
for (const s of skills) {
  for (const t of new Set([...s.nameTokens, ...s.descTokens])) {
    documentFrequency.set(t, (documentFrequency.get(t) || 0) + 1);
  }
}
const N = skills.length;
// Rarity, not raw IDF: how unusual a word is RELATIVE to this catalog, so a 6-skill
// library scores as sharply as a 600-skill one. Raw log-IDF collapses on small N
// (a word in 1 of 6 skills looks as common as a word in 1 of 172) and everything
// comes back [weak] — the exact failure mode when the router meets a new install.
function idfWeight(token, matchedInName) {
  const df = documentFrequency.get(token) || 0;
  const frac = df ? (df - 1) / Math.max(1, N - 1) : 0;
  const rarity = Math.pow(1 - Math.min(1, frac), 1.6);
  const w = 0.3 + 1.2 * rarity;
  // Curated names are signal even when the word is everywhere ("test-driven").
  return matchedInName ? Math.max(w, 0.8) : w;
}

function score(skill, qTokens) {
  let s = 0;
  let bestIdf = 0;
  let conceptHit = false;
  const hits = [];
  const topical = [];
  const detail = [];
  for (const q of qTokens) {
    const weak = GENERIC.has(q);
    let best = 0;
    let where = "";
    if (skill.nameSet.has(q)) {
      best = weak ? 4 : 8;
      where = "name";
    } else if (skill.nameTokens.some((t) => t === q || (q.length >= 4 && t.startsWith(q)))) {
      best = weak ? 2.5 : 5;
      where = "name~";
    }
    let descBest = 0;
    if (skill.descSet.has(q)) descBest = weak ? 1.6 : 3.5;
    else if (skill.descTokens.some((t) => q.length >= 4 && t.startsWith(q))) descBest = weak ? 1 : 2;
    else if (q.length >= 4 && skill.descLower.includes(q)) descBest = weak ? 0.5 : 1.2;
    if (descBest > best) {
      best = descBest;
      where = "desc";
    }
    if (best) {
      const w = idfWeight(q, where.startsWith("name"));
      const v = best * w;
      s += v;
      if (w > bestIdf) bestIdf = w;
      hits.push(q);
      detail.push(`${q}:${where}×${v.toFixed(1)}`);
      if (!weak) topical.push(q);
    }
  }
  // Coverage, softened: a single precise hit on a short scruffy query must not be
  // zeroed out because the user also said "my" "school" and "competition".
  const topicalTotal = qTokens.filter((t) => !GENERIC.has(t)).length || 1;
  if (topicalTotal > 1) s *= 0.62 + 0.38 * Math.min(1, topical.length / topicalTotal);
  if (query.length > 6 && skill.descLower.includes(lowerQuery)) s += 4;

  // Curated intent boosts.
  for (let i = 0; i < CONCEPTS.length; i++) {
    const c = CONCEPTS[i];
    if (!c.when.test(lowerQuery)) continue;
    if (c.unless && c.unless.test(lowerQuery)) continue;
    if (c.boost && c.boost[skill.name]) {
      s += c.boost[skill.name];
      conceptHit = true;
      detail.push(`concept+${c.boost[skill.name]}`);
    }
    if (c.demote && c.demote[skill.name]) {
      s *= c.demote[skill.name];
      detail.push(`concept×${c.demote[skill.name]}`);
    }
  }

  // Platform gates last: they can zero a score that concept boosts inflated.
  for (const g of GATES) {
    if (g.names.some((n) => skill.name.startsWith(n)) && !g.need.some((k) => lowerQuery.includes(k))) {
      s *= 0.15;
      detail.push("gated");
    }
  }
  // Portable gate, no skill names involved: if the only words this skill matched
  // are undiscriminating ones ("app", "render", "user"), the match is an accident
  // of vocabulary, not a sign it is the right specialist. Works in a catalog this
  // tool has never seen, which the ecosystem gates above cannot.
  if (!conceptHit && bestIdf < 0.68 && s > 0) {
    s *= 0.45;
    detail.push("weak-vocab");
  }
  if (DEMOTE[skill.name]) {
    s *= DEMOTE[skill.name];
    detail.push(`family×${DEMOTE[skill.name]}`);
  }
  return { s, hits, detail };
}

if (flags.name) {
  const exact = skills.filter((s) => s.name === flags.name);
  const near = skills.filter((s) => s.name.includes(flags.name));
  for (const s of exact.length ? exact : near) console.log(`${s.name}\t${s.file}`);
  if (!exact.length && !near.length) {
    console.error(`no skill named ${flags.name}`);
    process.exit(1);
  }
  process.exit(0);
}

if (flags.doctor) {
  // Environment self-check: answer "is this thing even seeing my skills?" without
  // making the reader guess. Exit 1 only when the catalog is empty.
  console.log(`catalog: ${skills.length} skills (${skills.filter((s) => s.hidden).length} model-hidden)\n`);
  console.log("roots:");
  for (const r of ACTIVE_ROOTS) {
    const found = files.filter((f) => f.startsWith(r + path.sep) || path.dirname(f) === r).length;
    let exists = true;
    try {
      fs.statSync(r);
    } catch {
      exists = false;
    }
    console.log(`  ${exists ? "✓" : "·"} ${r}${exists ? `  (${found} SKILL.md)` : "  (missing, skipped)"}${ENV_ROOTS.length ? "" : exists ? "" : ""}`);
  }
  if (duplicates.length) {
    console.log(`\nduplicate names (first root wins):`);
    for (const d of duplicates) console.log(`  ${d.name}: kept ${d.kept}  dropped ${d.dropped}`);
  }
  if (unparsable.length) {
    console.log(`\nunparsable SKILL.md (no name/description frontmatter):`);
    for (const f of unparsable.slice(0, 10)) console.log(`  ${f}`);
    if (unparsable.length > 10) console.log(`  ... and ${unparsable.length - 10} more`);
  }
  if (!skills.length) {
    console.log(
      "\nNo skills found. Point the router at your skill directories:\n  SKILL_ROUTER_ROOTS=/path/to/skills node find_skills.mjs \"...\"\n  node find_skills.mjs --root /path/to/skills --all",
    );
    process.exit(1);
  }
  const local = path.join(path.dirname(fileURLToPath(import.meta.url)), "concepts.local.json");
  console.log(`\nlocal overlay: ${fs.existsSync(local) ? local : "none (fine)"}`);
  process.exit(0);
}

if (!query && !flags.all) {
  console.error("usage: find_skills.mjs \"<task words>\" [-n 8] [--explain] [--json] [--root DIR]\n       find_skills.mjs --all | --name pdf | --doctor");
  process.exit(2);
}

if (flags.all) {
  for (const s of skills) {
    if (s.hidden) continue;
    console.log(`${s.name}\t${s.description}\t${s.file}`);
  }
  console.error(`\n${skills.length} skills indexed from ${ACTIVE_ROOTS.length} roots`);
  process.exit(0);
}

if (!skills.length) {
  console.error("no skills indexed — run --doctor to see which roots were scanned");
  process.exit(1);
}

const qTokens = [...new Set(tokens(query))];
const ranked = skills
  .filter((s) => !s.hidden)
  .map((s) => ({ ...s, ...score(s, qTokens) }))
  .filter((s) => s.s > 0.5)
  .sort((a, b) => b.s - a.s || a.name.localeCompare(b.name));

const MIN = 3.0;
const cutoff = Math.max(MIN, (ranked[0]?.s || 0) * 0.28);
const top = ranked[0] && ranked[0].s >= MIN ? ranked.filter((s) => s.s >= cutoff).slice(0, limit) : [];

if (flags.json) {
  console.log(
    JSON.stringify(
      top.map(({ name, description, file, s, hits }) => ({ name, description, file, score: +s.toFixed(1), hits })),
      null,
      2,
    ),
  );
  process.exit(0);
}

console.log(`query: ${query}`);
console.log(`${qTokens.join(", ") || "(none)"} | ${skills.length} skills indexed\n`);
if (!top.length) {
  console.log("NO GOOD MATCH — do the task without a skill, or retry with plainer task words.");
  if (skills.length < 10) console.log(`(catalog is only ${skills.length} skills — check --doctor)`);
  process.exit(0);
}
if (top.every((s) => s.s < 5)) {
  console.log("All matches are weak. Prefer your own judgement, or widen the query.\n");
}
for (const s of top) {
  const d = s.description.length > 190 ? s.description.slice(0, 187) + "..." : s.description;
  // Confidence tiers: a 3-point match is a guess and should read as one, otherwise
  // weak lexical hits get followed as if they were answers.
  const tier = s.s >= 8 ? "strong" : s.s >= 5 ? "likely" : "weak";
  console.log(`${s.s.toFixed(1).padStart(5)}  ${s.name}  [${tier}]`);
  console.log(`       ${d}`);
  console.log(`       -> ${s.file}`);
  if (flags.explain) console.log(`       why: ${s.detail.join(" ")}`);
}
