#!/usr/bin/env node
// Regression harness for the router. Each case is a realistic user phrasing plus
// the set of skills that are genuinely acceptable answers. A case passes when any
// acceptable skill appears in the top 3 of find_skills.mjs output.
//
//   node scripts/eval_routing.mjs            # score every case
//   node scripts/eval_routing.mjs --verbose  # show the full ranking per case
//   node scripts/eval_routing.mjs quest      # only cases whose name matches
//
// Run this BEFORE and AFTER any change to find_skills.mjs or task-types.md.
// A change that raises the score is an improvement; a change that lowers it is a
// regression, no matter how much nicer the code looks.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEARCH = path.join(HERE, "find_skills.mjs");

// expect: acceptable answers, best first. "NONE" means the router should print
// NO GOOD MATCH — a wrongly-matched skill costs more than no skill.
const CASES = [
  // ---- frontend taste / design -------------------------------------------
  { q: "my landing page looks like every other AI startup site", expect: ["design-taste-frontend", "ui-craft", "impeccable"] },
  { q: "redesign the settings screen so it stops feeling cheap", expect: ["impeccable", "polish", "design-taste-frontend"] },
  { q: "the font pairing and line height feel off", expect: ["typeset"] },
  { q: "no color identity, everything is default blue", expect: ["colorize"] },
  { q: "denser analytics admin table with mono numbers", expect: ["ui-craft-dense-dashboard"] },
  { q: "long form magazine article layout", expect: ["ui-craft-editorial"] },
  { q: "minimal whitespace heavy linear style app shell", expect: ["ui-craft-minimal", "ui-craft"] },
  { q: "review my UI for accessibility problems", expect: ["web-design-guidelines", "critique"] },

  // ---- motion ------------------------------------------------------------
  { q: "make this popover bounce in when it opens", expect: ["animate"] },
  { q: "swipe to dismiss bottom sheet in my expo app", expect: ["animate-expo"] },
  { q: "smooth shared element transition between routes", expect: ["vercel-react-view-transitions"] },
  { q: "scan the codebase for missing micro interactions", expect: ["find-animation-opportunities", "improve-animations"] },
  { q: "what is it called when the list rubber bands on ios", expect: ["animation-vocabulary"] },
  { q: "feel more native on phone, input zooms the page", expect: ["mobile-native"] },
  { q: "fancy animated react hero section components", expect: ["react-bits"] },

  // ---- process -----------------------------------------------------------
  { q: "debug this TypeError my node server throws on boot", expect: ["systematic-debugging"] },
  { q: "write unit tests for the pricing calculator", expect: ["test-driven-development"] },
  { q: "I have a vague idea for an app, no spec yet", expect: ["brainstorming"] },
  { q: "break this migration into a plan then execute it", expect: ["writing-plans", "executing-plans"] },
  { q: "execute these independent tasks in parallel", expect: ["dispatching-parallel-agents", "subagent-driven-development"] },
  { q: "protect the workspace before risky refactor work", expect: ["using-git-worktrees"] },
  { q: "review my pr before merge", expect: ["requesting-code-review", "dsh-code-review"] },
  { q: "is this actually finished or am I fooling myself", expect: ["verification-before-completion", "verification-loop", "verification"] },
  { q: "should I take the internship or keep building my startup", expect: ["council", "council-mode"] },
  { q: "what did we decide about the apartment hunt plan last time", expect: ["memory-mnemon"] },
  { q: "make a new skill for our deploy checklist", expect: ["skill-creator", "writing-skills"] },

  // ---- back end / platform ----------------------------------------------
  { q: "design a REST endpoint for cancelling an order", expect: ["api-design", "backend-patterns"] },
  { q: "which storage and queue should I pick for this app", expect: ["create-a-backend", "vercel-storage"] },
  { q: "lock down auth, secrets and payment input", expect: ["security-review", "auth"] },
  { q: "nextjs app router caching is stale after deploy", expect: ["nextjs", "next-cache-components", "cdn-caching"] },
  { q: "partial prerendering with use cache directive", expect: ["next-cache-components"] },
  { q: "turbopack dev build is slow to start", expect: ["turbopack"] },
  { q: "deploy to vercel and roll back the bad release", expect: ["deployments-cicd", "vercel-cli"] },
  { q: "feature flags with gradual rollout and segments", expect: ["flags-sdk"] },
  { q: "background job that retries and pauses for days", expect: ["workflow", "queues"] },
  { q: "run untrusted generated code in isolation", expect: ["vercel-sandbox"] },
  { q: "split the app into multi zone microfrontends", expect: ["microfrontends"] },
  { q: "protected vercel preview returns 403 to curl", expect: ["access-protected-vercel-deployment"] },
  { q: "buy a domain and point DNS at my project", expect: ["domains"] },
  { q: "blob upload for user images", expect: ["vercel-storage"] },

  // ---- AI / agents -------------------------------------------------------
  { q: "build an AI agent that calls tools and remembers state", expect: ["build-agents", "eve", "ai-sdk"] },
  { q: "stream tokens from an LLM into my chat ui", expect: ["ai-sdk"] },
  { q: "which model should I use and cap my spend", expect: ["ai-gateway"] },
  { q: "telegram and slack bot from one codebase", expect: ["chat-sdk"] },
  { q: "chrome extension that blocks distracting sites", expect: ["chrome-extensions"] },

  // ---- documents / data --------------------------------------------------
  { q: "turn this markdown into a word document", expect: ["docx"] },
  { q: "fill in this PDF form and merge two PDFs", expect: ["pdf"] },
  { q: "quarterly report spreadsheet with formulas and a chart", expect: ["xlsx"] },
  { q: "seed round pitch deck and one pager", expect: ["investor-materials"] },
  { q: "html presentation slides for a talk", expect: ["frontend-slides"] },
  { q: "pull design tokens out of this figma file into tailwind", expect: ["figma-bridge"] },
  { q: "architecture diagram of our services as svg", expect: ["diagram-design"] },
  { q: "poster for the school startup competition", expect: ["canvas-design", "algorithmic-art"] },
  { q: "blog post about our launch", expect: ["article-writing"] },
  { q: "thread for X plus a linkedin version of the same story", expect: ["content-engine"] },
  { q: "match the voice of these past posts in my copy", expect: ["brand-voice"] },

  // ---- VR / Quest (gate must fire) ---------------------------------------
  { q: "quest 3 hand tracking is jittery in unity", expect: ["hz-unity-meta-core-sdk", "hz-vr-debug", "hz-quest-verify-first", "hz-immersive-designer"] },
  { q: "perfetto trace shows frame drops on my quest build", expect: ["hz-perfetto-debug"] },
  { q: "read the passthrough camera image on quest 3", expect: ["hz-unity-passthrough-camera-access"] },
  { q: "ship my web app to the meta horizon store as a pwa", expect: ["hz-store-pwa"] },
  { q: "android app on quest as a flat panel", expect: ["hz-android-2d-porting", "hz-spatial-sdk"] },

  // ---- browser / desktop control ----------------------------------------
  { q: "click through the checkout on the site I'm logged into", expect: ["kimi-webbridge"] },
  { q: "record a gif of my web UI for the readme", expect: ["record-browser-gif"] },
  { q: "drive this windows app like a user would", expect: ["kimi-cu"] },
  { q: "playwright suite fails randomly in CI", expect: ["e2e-testing", "playwright-cli"] },
  { q: "check that the dev server app actually works", expect: ["webapp-testing", "verification"] },

  // ---- gates: the right answer here is a GENERIC skill -------------------
  { q: "debug my react app that renders a blank screen", expect: ["systematic-debugging", "frontend-patterns"] },
  { q: "build a dashboard for tracking my habits", expect: ["ui-craft", "frontend-patterns", "design-taste-frontend"] },
  { q: "spreadsheet for my monthly budget", expect: ["xlsx"] },
  { q: "write documentation for my project", expect: ["doc-coauthoring", "dsh-doc-standards"] },

  // ---- held-out phrasings, added after the first tuning pass ------------
  { q: "add a calendar date picker to the form", expect: ["modern-web-guidance", "shadcn", "frontend-patterns"] },
  { q: "the modal sits behind the tooltip", expect: ["modern-web-guidance", "ask-sonner", "apple-design"] },
  { q: "why does my useEffect run twice", expect: ["frontend-patterns", "react-best-practices"] },
  { q: "my sheet music app state gets out of sync between tabs", expect: ["frontend-patterns", "modern-web-guidance", "react-best-practices"] },
  { q: "user uploads keep failing with a 413", expect: ["systematic-debugging", "vercel-functions"] },
  { q: "convert my resume to a pdf for applications", expect: ["pdf"] },
  { q: "make the checkout flow faster on mobile", expect: ["mobile-native", "impeccable", "frontend-patterns"] },
  { q: "design a landing page for a school competition", expect: ["design-taste-frontend", "ui-craft", "impeccable"] },
  { q: "my quest store submission got rejected", expect: ["hz-store-submit", "hz-quest-verify-first"] },
  { q: "I need a business plan for investors", expect: ["investor-materials", "writing-plans"] },
];

// Skills that must NEVER appear for a given query — the platform-gate failures.
const FORBID = [
  { q: "debug my react app that renders a blank screen", names: [/^hz-/, /portal/, /metavr/, /cloudbase/] },
  { q: "build a dashboard for tracking my habits", names: [/^hz-/, /cloudbase/, /metavr/] },
  { q: "write a blog post about our launch", names: [/^hz-/, /cloudbase/] },
  { q: "my landing page looks like every other AI startup site", names: [/^hz-/, /cloudbase/, /metavr/] },
  { q: "spreadsheet for my monthly budget", names: [/^hz-/, /cloudbase/] },
];

const args = process.argv.slice(2);
const verbose = args.includes("--verbose") || args.includes("-v");
const filter = args.find((a) => !a.startsWith("-"));

// Which skills this machine actually has. Cases whose expected answers are not
// installed are skipped rather than failed, so the suite works on any install —
// the repo is just the router, not the skill library it routes over.
let installed = new Set();
try {
  const all = execFileSync(process.execPath, [SEARCH, "--all"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  for (const line of all.split("\n")) {
    const name = line.split("\t")[0]?.trim();
    if (name) installed.add(name);
  }
} catch {
  console.error("could not index the catalog; run find_skills.mjs --all to debug");
  process.exit(2);
}

function run(query) {
  const out = execFileSync(process.execPath, [SEARCH, query, "-n", "8"], { encoding: "utf8" });
  const names = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*([\d.]+)\s+(\S+)\s+(?:\[\w+\])?\s*$/);
    if (m) names.push(m[2]);
  }
  return { none: out.includes("NO GOOD MATCH"), names, raw: out };
}

let pass = 0;
let fail = 0;
let skipped = 0;
const failures = [];

for (const c of CASES) {
  if (filter && !c.q.includes(filter)) continue;
  const usable = c.expect.includes("NONE") || c.expect.some((n) => installed.has(n));
  if (!usable) {
    skipped++;
    if (verbose) console.log(`SKIP  ${c.q}  (none of ${c.expect.join(", ")} installed)`);
    continue;
  }
  const { none, names } = run(c.q);
  const top3 = names.slice(0, 3);
  const hit = c.expect.includes("NONE") ? none : top3.some((n) => c.expect.includes(n));
  if (hit) pass++;
  else {
    fail++;
    failures.push({ q: c.q, want: c.expect, got: names.slice(0, 4), none });
  }
  if (verbose) {
    console.log(`${hit ? "PASS" : "FAIL"}  ${c.q}`);
    console.log(`      want: ${c.expect.join(" | ")}`);
    console.log(`      got : ${none ? "NO GOOD MATCH" : names.slice(0, 5).join(", ")}`);
  }
}

let gateFails = 0;
for (const g of FORBID) {
  if (filter && !g.q.includes(filter)) continue;
  const { names } = run(g.q);
  const bad = names.slice(0, 5).filter((n) => g.names.some((re) => re.test(n)));
  if (bad.length) {
    gateFails++;
    failures.push({ q: g.q, want: ["(no gated skill)"], got: bad, none: false });
    if (verbose) console.log(`FAIL  gate: ${g.q} leaked ${bad.join(", ")}`);
  }
}

if (!verbose) {
  for (const f of failures) {
    console.log(`FAIL  ${f.q}`);
    console.log(`      want: ${f.want.join(" | ")}`);
    console.log(`      got : ${f.none ? "NO GOOD MATCH" : f.got.join(", ")}`);
  }
}

const total = pass + fail;
const pct = total ? ((pass / total) * 100).toFixed(1) : "0.0";
console.log(
  `\nscore: ${pass}/${total} (${pct}%)  gate leaks: ${gateFails}` +
    (skipped ? `  skipped: ${skipped} (not installed here)` : ""),
);
process.exit(fail + gateFails === 0 ? 0 : 1);
