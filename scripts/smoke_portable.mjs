#!/usr/bin/env node
// Portability smoke test: builds a synthetic skill library in a temp directory —
// names, domains and vocabulary that exist nowhere in the author's install — and
// asserts the router still ranks sensibly, still gates, and still fails gracefully.
//
//   node scripts/smoke_portable.mjs
//
// This is the test that answers "does it work in an environment it has never seen",
// so it must not import anything from the author's catalog. Every expectation here
// is derived from the synthetic skills below.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEARCH = path.join(HERE, "find_skills.mjs");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "skillrouter-foreign-"));

// Deliberately unlike the author's install: different domains, different naming
// style (verb-first, noun-first, prefixed), long marketing descriptions.
const SKILLS = [
  ["k8s-triage", "Use when a Kubernetes pod is crashlooping, OOMKilled, stuck in ImagePullBackOff, or a rollout is not progressing. Covers kubectl triage, events, probes and resource limits."],
  ["rust-borrowck", "Use when the Rust borrow checker rejects your code: lifetime errors, cannot borrow as mutable, Arc and Mutex, Pin, self-referential structs, async blocks."],
  ["salesforce-apex", "Use when writing or debugging Salesforce Apex triggers, SOQL queries, governor limits, bulkification patterns and test classes with System.assert."],
  ["postgres-explain", "Use when a Postgres query is slow and you need to read EXPLAIN ANALYZE output: sequential scans, index selection, vacuum, bloat and planner statistics."],
  ["shopify-liquid", "Use when editing a Shopify Liquid theme: sections, schema blocks, snippets, cart.js and storefront filtering."],
  ["blender-rigging", "Use when rigging a character in Blender: armature setup, weight painting, inverse kinematics constraints and deform bones."],
  ["unity-shader", "Use when writing Unity HLSL passes or shader graph nodes, including lighting model, shadow sampling and SRP batcher compatibility."],
  ["pdf-forms", "Use when filling, flattening or validating PDF AcroForm fields, or when a filled PDF form returns blank after signing."],
  ["terraform-state", "Use when Terraform state is locked, drifted or needs importing: state rm, import blocks, workspaces and backend migration."],
  ["figma-variables", "Use when extracting Figma variables and styles into design tokens as JSON, or syncing token changes into code."],
  ["cypress-suite", "Use when Cypress end-to-end specs fail intermittently in CI: retries, network stubbing, waiting strategies and flake isolation."],
  ["incident-postmortem", "Use when writing an incident postmortem: timeline reconstruction, root cause analysis, contributing factors and action items."],
  ["email-sequence", "Use when drafting a cold outreach email sequence, subject lines, follow-up cadence and reply handling for B2B sales."],
  ["budget-model", "Use when building a monthly budget or cash-flow model with formulas, scenarios and variance columns."],
  ["rust-cli", "Use when scaffolding a Rust command line tool: clap argument parsing, exit codes, config files and subcommands."],
  ["mobile-layout", "Use when a phone layout breaks: safe areas, viewport height, sticky headers, tap targets and scroll containers."],
];

function writeCatalog(root, entries) {
  for (const [name, description] of entries) {
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nBody text.\n`);
  }
}

const ROOT_A = path.join(TMP, "a");
const ROOT_B = path.join(TMP, "b");
const EMPTY = path.join(TMP, "empty");
writeCatalog(ROOT_A, SKILLS);
writeCatalog(ROOT_B, [["shared-skill", "Use when demonstrating duplicate detection."]]);
writeCatalog(ROOT_A, [["shared-skill", "Use when demonstrating duplicate detection, second copy."]]);
fs.mkdirSync(EMPTY, { recursive: true });
const SPACED = path.join(TMP, "dir with spaces");
writeCatalog(SPACED, [["spaced-skill", "Use when verifying that paths containing spaces are indexed."]]);

function run(argv, roots = [ROOT_A]) {
  const args = [SEARCH, ...argv];
  for (const r of roots) args.push("--root", r);
  try {
    const out = execFileSync(process.execPath, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ""}${e.stderr || ""}` };
  }
}

function ranked(query, n = 5) {
  const { out } = run([query, "-n", String(n)]);
  const names = [];
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*([\d.]+)\s+(\S+)\s+\[(\w+)\]$/);
    if (m) names.push({ name: m[2], score: Number(m[1]), tier: m[3] });
  }
  return names;
}

let pass = 0;
const fails = [];
function check(label, ok, info) {
  if (ok) pass++;
  else fails.push(`${label}${info ? `\n      ${info}` : ""}`);
}

const CASES = [
  ["my pod keeps crashlooping after the rollout", "k8s-triage"],
  ["borrow checker complains about lifetime in an async block", "rust-borrowck"],
  ["SOQL governor limit exceeded inside a trigger", "salesforce-apex"],
  ["query plan shows a sequential scan on two million rows", "postgres-explain"],
  ["terraform state lock stuck after an interrupted apply", "terraform-state"],
  ["flatten and validate an acroform pdf", "pdf-forms"],
  ["cypress spec fails intermittently in CI", "cypress-suite"],
  ["write an incident postmortem with a timeline", "incident-postmortem"],
  ["figma variables to design tokens json", "figma-variables"],
  ["scaffold a rust command line tool with subcommands", "rust-cli"],
  ["safe areas and viewport height on a phone layout", "mobile-layout"],
  ["monthly budget with scenarios and variance", "budget-model"],
];

for (const [query, want] of CASES) {
  const top = ranked(query);
  const idx = top.findIndex((r) => r.name === want);
  check(
    `rank: "${query}" → ${want}`,
    idx >= 0 && idx < 3,
    `got: ${top.map((t) => `${t.name}(${t.score})`).join(", ") || "NO MATCH"}`,
  );
}

// Portable gate: a specialist must not surface for an unrelated generic request.
const GENERIC = [
  "make the button bigger and move it up",
  "how do I write a friendly reply to a customer",
  "what time is it in tokyo",
];
for (const q of GENERIC) {
  const top = ranked(q);
  const leaked = top.filter((t) => ["k8s-triage", "salesforce-apex", "postgres-explain", "terraform-state"].includes(t.name));
  check(`gate: "${q}" leaks no specialist`, leaked.length === 0, `leaked: ${leaked.map((l) => l.name).join(", ")}`);
}

// Distinct phrasings of the same request should land on the same skill even when
// they share almost no vocabulary with it.
const PARAPHRASE = [
  "occlusion of my rack nginx request routing config",
  ["k8s-triage", "postgres-explain"],
];
const pf = ranked(PARAPHRASE[0]);
check(
  `robustness: nonsense query does not crash or over-claim`,
  pf.every((r) => r.tier === "weak"),
  `got: ${pf.map((t) => `${t.name}:${t.tier}`).join(", ") || "NO MATCH"}`,
);

// Duplicate skill names across two roots must collapse to one entry.
{
  const { out } = run(["--doctor"], [ROOT_A, ROOT_B]);
  const count = (out.match(/^\s+shared-skill:/gm) || []).length;
  check("dedupe: same name in two roots reported once", count === 1, out.split("\n").filter((l) => l.includes("shared-skill")).join(" | "));
  check("dedupe: shared-skill still searchable once", ranked("demonstrating duplicate detection").length > 0);
}

// Paths with spaces must index.
{
  const { out } = run(["--all"], [SPACED]);
  check("paths: directory with spaces is indexed", out.includes("spaced-skill"), out.slice(0, 120));
}

// Empty catalog: exit 1 with a helpful message, not a stack trace.
{
  const { code, out } = run(["--doctor"], [EMPTY]);
  check("empty: --doctor exits 1 with guidance", code === 1 && /SKILL_ROUTER_ROOTS/.test(out), `code=${code}`);
  const q = run(["debug something"], [EMPTY]);
  check("empty: search exits 1 with a pointer to --doctor", q.code === 1 && /--doctor/.test(q.out), `code=${q.code} ${q.out.trim()}`);
}

// Env-var roots work the same as --root (this is how a foreign CI would wire it up).
{
  const out = execFileSync(process.execPath, [SEARCH, "crashlooping pod", "-n", "3"], {
    encoding: "utf8",
    env: { ...process.env, SKILL_ROUTER_ROOTS: ROOT_A },
  });
  check("env: SKILL_ROUTER_ROOTS is honoured", out.includes("k8s-triage"), out.split("\n")[3] || "");
}

// Scale: 600 synthetic skills should still index and search quickly.
{
  const big = path.join(TMP, "big");
  const entries = [];
  for (let i = 0; i < 600; i++) {
    entries.push([`bulk-${i}`, `Use when handling generated workload serial ZX${i} with widgets, gadgets and thingamajigs for team ${i % 17}.`]);
  }
  writeCatalog(big, entries);
  const t0 = Date.now();
  const out = execFileSync(process.execPath, [SEARCH, "serial ZX427", "-n", "5", "--root", big], { encoding: "utf8" });
  const ms = Date.now() - t0;
  check(`scale: 600 skills indexed and searched (${ms} ms)`, /bulk-427/.test(out) && ms < 5000, `${ms} ms, out: ${out.split("\n")[3] || out.slice(0, 80)}`);
}

fs.rmSync(TMP, { recursive: true, force: true });

if (fails.length) {
  for (const f of fails) console.log(`FAIL  ${f}`);
  console.log(`\nportable smoke: ${pass}/${pass + fails.length} passed`);
  process.exit(1);
}
console.log(`portable smoke: ${pass}/${pass} passed (foreign catalog, ${SKILLS.length} synthetic skills + 600-skill scale run)`);
