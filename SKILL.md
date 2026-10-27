---
name: skill-router
description: Pick the right skill or skill chain for a task, load it in the right order, and ask only the questions that actually block the work. Works against any installed skill library of any size — it indexes whatever skill directories exist and needs no knowledge of their names. Use this on every request that involves real work — building or fixing code, designing or reviewing UI, debugging, refactoring, deploying, research, writing, pitch decks, documents, spreadsheets, slides, animation, writing, or auditing an existing project — and especially when the request is vague, spans several areas, is brand new, or you are not certain which installed skill applies. Also use it when the user says "route this", "which skill", "use whatever fits", "figure out the right approach", or hands over a task with no explicit tooling. Skip only for pure conversation, one-line factual questions, and follow-ups inside a workflow already routed.
---

# Skill Router

There are currently ~170 skills installed here and they vary wildly in quality and scope,
several of them near-duplicates of each other (three separate "make it not look generic"
design skills, two copies of impeccable, `xlsx` next to `xlsx-dsh`). Picking badly is the
single most expensive mistake available: a wrong skill costs its whole body in context
and drags the answer off-target, while no skill at all usually beats the wrong skill.

So: route first, then work. This file is the routing procedure. It is cheap — one
file scan, one or two tool calls — and it replaces guessing from the skill list. The
procedure is install-agnostic: the counts, names and families below describe the
catalog it was written against, and the search normalises to whatever catalog it finds.

## 1. Read the task before touching anything

Answer these silently, in one line each. They decide the route, not the deliverable.

- **What gets produced?** A file (docx/xlsx/pdf/pptx/png), running code, a decision, a message, a plan.
- **What domain?** Web frontend, backend, data, docs, design, video/animation, VR, ops.
- **Is there an existing artifact?** Greenfield vs. modifying someone's code — this flips
  the route from build skills to audit/review and understand-first skills.
- **Who reads the output?** Investor, teacher, teammate, compiler. Audience changes the
  writing skill, not the technical one.

If the request is one sentence of pure intent ("make me something cool"), that is a
routing signal too: it means no skill can be chosen yet and questions come first (step 6).

## 2. Fast path — check the routing table

Read `references/task-types.md` (relative to this skill directory). The first table maps
~40 common task shapes to a verified skill chain in one screen; the second lists narrow
tools with unguessable names (`animation-vocabulary`, `cdn-caching`, `vercel-connect`)
that no one searches for, so check it before concluding nothing fits.

- **Match found** → go to step 4 with that chain. Do not also search; the table is
  the answer and searching again just burns tokens.
- **No match, or the match is partial** → step 3.
- **The table names skills you do not have** (a different install, a different
  harness, a fresh machine) → skip the table entirely and go to step 3. The table is
  one install's mapping; the search works on any catalog. Verify with `--doctor`.

## 3. Search the catalog

One command, no model needed:

```bash
# path is relative to this skill's directory
node scripts/find_skills.mjs "landing page feels generic" -n 8
node scripts/find_skills.mjs --doctor      # which roots were scanned, what was found
```

It scores all installed skills on name + description (IDF-weighted, so rare words win
over `user`/`code`/`when`) plus a curated concept layer for phrasings that share no
vocabulary with the skill they need. Prints the top matches with their `SKILL.md`
paths, or `NO GOOD MATCH` when nothing fits.

How to query it well:

- Use the task's **nouns**, not the user's sentence: `spreadsheet charts csv`, not
  "can you turn this into something with a graph".
- Run **2–3 different angles** rather than one long query — the artifact angle
  (`pitch deck`), the domain angle (`investor fundraising`), the problem angle
  (`text looks templated`). Batch them in one bash call if you like.
- `--explain` prints why each result ranked, token by token — use it when a result
  looks wrong rather than guessing at the cause.
- Each result is tagged `[strong]`, `[likely]` or `[weak]`. **`[weak]` means the
  router is guessing from one incidental word** — treat it as a suggestion, not an
  answer, and prefer your own judgement. If every result is weak the script says so.
- `--all` dumps the full catalog, `--name pdf` resolves one name to a path, `--json`
  gives machine-readable output, `-n 20` widens the list when you want to see the
  runners-up (often the right answer is #4 for a badly-phrased query).
- Results are ranked, not authoritative. You still choose.
- The script lives in this skill's `scripts/` directory. If the harness exposes an
  absolute path, use it; otherwise `cd` into the skill directory first.
- **It indexes whatever exists**, not a fixed list: it scans the usual per-user and
  per-project skill directories across harnesses (`~/.pi`, `~/.claude`, `~/.codex`,
  `~/.agents`, `~/.cursor`, plus `<cwd>/skills` and plugin `node_modules`). Point it
  anywhere else with `SKILL_ROUTER_ROOTS=/a/skills:/b/skills` or `--root /a/skills`.
  On an unfamiliar machine, run `--doctor` first: it lists every root, whether it
  exists, how many skills it contributed, duplicate names, and `SKILL.md` files it
  could not parse. **No concepts or gates are needed for a new catalog** — they are
  optional boosts on top of the lexical ranking; with zero of them the search still
  ranks by name and description.

If the script itself is unavailable or a search returns nothing plausible twice, fall
back to reading `~/.pi/agent/skills/` descriptions from the system prompt list. Do not
stall, and do not open five `SKILL.md` files hoping one sticks.

## 4. Choose — rules that keep the chain short

1. **Process before implementation.** Skills that set *how* the work runs (brainstorming,
   writing-plans, systematic-debugging, test-driven-development, writing-skills) load
   before skills that set *what* the output looks like (design, docx, nextjs). Process
   skills frequently tell you to load an implementation skill next — let them.
2. **Three skills maximum.** One is normal, two is common, three is the ceiling. A fourth
   means you are collecting instead of deciding.
3. **One per family.** Never load two members of the same family — take the first column:

   | Family | Pick one |
   |---|---|
   | Frontend taste / anti-generic | `design-taste-frontend`, `ui-craft`, `impeccable`, `frontend-design`, `craft` |
   | Duplicated copies | `impeccable` (agents/) over `impeccable-dsh`; `xlsx` over `xlsx-dsh`; `kimi/*` over `dsh/*` unless the `dsh` one is clearly more specific |
   | Doc format | exactly the one matching the file: `docx`, `pdf`, `pptx`, `xlsx` |
   | Motion | `animate` (web), `animate-expo` (React Native) — not both |
   | Backend | `backend-patterns`, `create-a-backend`, `api-design` — at most two |
   | Quest / VR | `hz-*` family + `metavr-cli`; always start with `hz-quest-verify-first` |

4. **Respect platform gates.** `hz-*`, `portal`, `metavr-cli` need a Quest/VR context;
   `cloudbase` needs CloudBase; `kimi-webbridge` / `kimi-cu` need a real browser or
   desktop GUI. If the task does not name the platform, the skill does not apply no
   matter how well the words match.
5. **Justify or reject.** For each candidate, one clause: *why this one*. If the clause
   is "it mentions the same words", reject it. Two skills can share vocabulary and
   still be for different machines.
6. **None is a valid answer.** If nothing clears the bar, say so in a few words and do
   the task with your own judgement. A missing skill is not a reason to fire up a
   half-relevant one.
7. **Re-route on pivots only.** A new sub-task inside the same workflow does not
   trigger a fresh search. A change of domain (user says "actually make it a deck")
   does.

## 5. Announce in one line, then move

Before doing work, state the route once:

> Using `design-taste-frontend` (anti-templated landing page) → `animate` for the hero.
> No skill fits the copywriting part; writing that myself.

Rules for that line: one or two sentences, names + reasons only. No essays about the
skill inventory, no "I have selected the following skills for this task because…". The
user wants to see the decision, not the deliberation. If the route is unusual or you are
knowingly departing from the table, that is the one thing worth an extra clause.

## 6. Ask only what blocks the work

This is where routing earns its keep: a chosen skill tells you what it needs to know,
so ask *those* questions — and only those.

Ask when, and only when:

- the task has two or more genuinely different deliverables ("a poster" could be PNG or
  a slide deck, and the files differ),
- the audience or format is unknown and unguessable from context,
- the chosen skill's own instructions require a decision the user must own (brand,
  budget, credentials, real vs. mock data),
- a route would cost real money or touch production.

Do not ask:

- which skill to use — that is this skill's job. Ask about the *outcome*, let the
  routing follow from the answer,
- anything the request already answers, anything the codebase or files answer,
- anything a sane default covers. Pick the default, say which default you picked in the
  announce line, and keep moving. This user prefers long unattended runs over turn-by-turn
  confirmation.

Shape: one `ask_user_question` call, at most 3 questions, 2–4 options each, recommended
option first with "(Recommended)" on the label, one short sentence per option saying what
it commits to. Never stack a second questionnaire right after the first; if an answer
raises a new question, prefer a reasonable default over another round trip.

If the skill you loaded has its own discovery or question phase (most design and
planning skills do), run *that* instead of inventing your own. Two question rounds in a
row reads as stalling.

## 7. Load and execute

- Read the `SKILL.md` with the `read` tool, fully, at the path the search returned.
  Skimmed skills produce skimmed output.
- Resolve any `references/`, `scripts/`, `assets/` paths **relative to that skill's
  directory** — the search output prints the file, so the parent directory is the skill
  root.
- Run scripts as written. If a script needs an argument it does not document, say so
  rather than substituting your own implementation.
- **The skill wins ties.** Once loaded, its instructions override this file's opinions
  about how to do the work, and override generic good practice. This file only chose it.
- If a loaded skill opens with "ask the user first" or "plan before writing code", do
  that — routing to a process skill and then skipping its process is worse than not
  routing at all.
- If mid-work you discover the skill was wrong, say so plainly and re-route (step 4).
  Quietly working around a bad skill is the failure mode.

## 8. Close

One line at the end: which skills were used, and where the artifact landed. Then stop —
no summary of the skill contents, no offer to explain the routing.

## Maintenance — changing the router without breaking it

The router is scored, not vibed. `scripts/eval_routing.mjs` holds 80 realistic
queries, each with the set of skills that are genuinely acceptable answers, plus a
dozen gate cases (a generic React query must never surface a Quest skill). Run it
before and after any change:

```bash
node scripts/eval_routing.mjs
# score: 80/80 (100.0%)  gate leaks: 0
node ... --verbose      # per-case ranking
node ... quest          # only matching cases

node scripts/smoke_portable.mjs   # builds a foreign catalog and asserts it works
```

`smoke_portable.mjs` is the portability test: it invents 16 skills in domains this
router has never seen (Kubernetes, Rust, Salesforce, Terraform…), checks ranking,
paraphrase robustness, the portable gate, duplicate names, empty catalogs, paths with
spaces, `SKILL_ROUTER_ROOTS`, and a 600-skill scale run. If you change scoring, both
suites must stay green — the eval guards quality on a known catalog, the smoke guards
behaviour on an unknown one.

A change that raises the score is an improvement; a change that lowers it is a
regression no matter how much tidier the code reads. Cases whose expected skills are
not installed are skipped, not failed, so the suite runs on any machine.

**When a real task routes badly**, fix it at the cheapest layer that explains it:

1. **Wrong words for the same idea** → add a curated `CONCEPTS` rule in
   `find_skills.mjs` (`when` regex → `boost` scores, optional `unless` veto and
   `demote`). This is the layer for intent that shares no vocabulary with the skill:
   "vague idea, no spec" → `brainstorming`.
2. **A recurring task shape** → add a row to `references/task-types.md`. Costs
   nothing at query time and the fast path skips the search entirely.
3. **A skill that keeps losing to noisy neighbours** → add it to `DEMOTE`, or give
   the noisy one a `demote` in a concept (e.g. `dashboard` alone must not beat
   `ui-craft` with `ui-craft-dense-dashboard`).
4. **A platform skill leaking into generic queries** → extend `GATES` with the words
   that must be present for it to be eligible.

Add the failing query to `CASES` first, watch it fail, then fix. Do not tune the
scoring on queries you did not write down — that is how the router ends up good at
your examples and bad at the user's.

## Red flags — you are rationalising, stop

| Thought | Reality |
|---|---|
| "This is simple, no routing needed" | Route fast, implement fast. The fast path costs one file read. |
| "The task is obvious from the words" | Vocabulary overlap is not a match. Check the artifact and domain. |
| "I'll load all the design skills and see" | Pick one. Families are listed above for a reason. |
| "I know what `pdf` does" | Skills change. Read the current file before relying on it. |
| "Asking is annoying, I'll guess" | Guessing the deliverable format is the expensive one. Ask that. |
| "I'll ask 4 things to be safe" | Every extra question costs a turn. Blocking questions only. |
| "The user said do it, so skip the skill's discovery phase" | Explicit user instruction wins — otherwise follow the skill. |
| "The search returned a 3.1 match, that's the skill" | `[weak]` means one incidental word matched. Do the task yourself. |
| "I'll tune the scorer until this one query works" | Add the query to `CASES` first, or you are fitting your own examples. |

## Notes

- Skills with `disable-model-invocation: true` are hidden from the search. They still
  work as `/skill:name`. If you know a skill exists but it does not appear, try
  `--all` before concluding it is missing.
- `/skill:name task` forces a skill into the turn and skips all of the above — use it
  when the user has already named the skill.
- The catalog is generated live from disk, so newly installed or edited skills appear
  immediately. Re-run the search after installing anything.
- If `using-superpowers` is loaded, this skill is the concrete implementation of its
  "check for skills first" rule; they are not in conflict, so do not re-litigate it.
- A personal-context / memory skill is not a routing target — it is background about
  the user's projects. Read it when a task touches those, regardless of the route.
