# skill-router

A skill for AI coding agents that have **too many skills installed and no reliable way
to pick one**.

Install 50–200 skills and the model starts choosing badly, because nothing in the
harness tells it which skill is right for "the modal sits behind the tooltip". It
either grabs the first name that shares a word with the request, or ignores skills
entirely. Both are expensive: a wrong skill burns its whole body in context and drags
the answer off-target, and no skill at all usually beats the wrong skill.

This is a routing procedure plus a scored search tool. It costs one file read per task
and one local `node` process per search — no network, no model call, ~0.4 s.

## What's in the box

```
skill-router/
  SKILL.md                    # the procedure: read task → table → search → choose → announce
  references/task-types.md    # ~60 task shapes → verified skill chains (the fast path)
  scripts/find_skills.mjs     # catalog indexer + scorer + learning (the search)
  scripts/eval_routing.mjs    # 80 labelled cases, scored, with platform-gate checks
  scripts/smoke_portable.mjs  # synthetic foreign catalog, learning, scale
```

## Use

Copy the directory into whatever directory your harness discovers skills in — e.g.
`~/.pi/agent/skills/`, `~/.claude/skills/`, or `~/.agents/skills/`. Then, for any real
task, the agent loads `SKILL.md` and follows it.

Search directly:

```bash
cd skill-router

node scripts/find_skills.mjs "landing page feels generic" -n 8
node scripts/find_skills.mjs "quest 3 hand tracking is jittery in unity" --explain
node scripts/find_skills.mjs --all            # whole catalog, tab-separated
node scripts/find_skills.mjs --name pdf       # resolve one name to its path
node scripts/find_skills.mjs "deck" --json    # machine-readable
node scripts/find_skills.mjs --doctor         # what did it even find?
node scripts/find_skills.mjs --memory         # what has it learned?
```

Output, with confidence tiers so a guess reads as a guess:

```
query: add a calendar date picker to the form
calendar, date, picker, form | 172 skills indexed

  9.1  modern-web-guidance  [strong]
       Search tool for modern web development best practices...
       -> ~/.pi/agent/skills/plugin-modern-web-guidance/modern-web-guidance/SKILL.md
```

`[weak]` means exactly one incidental word matched — treat it as a suggestion, not an
answer. If everything is weak the script says so instead of pretending.

## How the score works

Lexical, corpus-aware, and debuggable — no embeddings, so every result can be explained:

1. **IDF over the catalog.** A word that appears in 150 descriptions (`user`, `when`,
   `code`) is noise; a word in 2 (`perfetto`, `kerning`) is nearly a skill name. This
   is what stops long descriptions from winning on surface area alone.
2. **Name beats description.** Matching a curated skill's name outranks matching a
   paragraph of someone else's prose.
3. **Intent verbs are demoted, subject words are not.** `build`/`create` mean "this is
   work"; `debug`/`test`/`deploy`/`review` name whole skills and stay topical.
4. **Softened coverage.** Matching 3 of 4 content words beats matching 1 of 1, but a
   single precise hit is not zeroed out because the user also said "my" and "school".
5. **`CONCEPTS`** — ~35 curated regex rules for phrasings that share no vocabulary with
   the skill they need ("vague idea, no spec" → `brainstorming`, "is this actually
   finished" → a verification skill). Each rule can `boost`, `demote`, or veto with
   `unless`.
6. **`GATES`** — platform skills (VR/Quest, CloudBase, a specific cloud console,
   desktop-GUI control) collapse to 15% unless the platform is named. Without this,
   "debug my react app" ranks a VR profiler above every debugging skill because both
   say *debug* and *render*.

Order matters: gates run **last**, so a concept boost can never smuggle a
platform-specific skill into a generic query.

### The portable gate

The `GATES` table above is a set of hints for ecosystems the author happens to know.
The mechanism that works on a catalog nobody has seen is **lexical confidence**: if the
only words a skill matched are undiscriminating (`app`, `render`, `user`, `page`), the
match is an accident of vocabulary, not a signal, and it is demoted. No names, no
configuration, works for a skill called `k8s-triage` on first contact.

### Sizes

Rarity is computed **relative to the catalog**, not with raw log-IDF. A word in 1 of 6
skills scores as strongly as a word in 1 of 600 — raw IDF collapses on small catalogs
and turns every result `[weak]`, which is exactly how a router fails when it meets a
fresh install. Verified at 6, 16, 172 and 600 skills.

## Works on any catalog

Nothing is hardcoded to a particular library. Discovery scans the usual per-user and
per-project skill directories across harnesses, and collapses duplicate names (first
root wins, `--doctor` reports the loser):

```
~/.pi/agent/skills      ~/.claude/skills       ~/.codex/skills
~/.agents/skills        ~/.cursor/skills       ~/.copilot/skills
~/.config/agents/skills <cwd>/.claude/skills   <cwd>/.agents/skills
<plugin>/node_modules   <cwd>/.pi/skills        <cwd>/skills
```

Point it anywhere else, anywhere at all:

```bash
SKILL_ROUTER_ROOTS=/opt/team/skills:/srv/agents/skills node scripts/find_skills.mjs "..."
node scripts/find_skills.mjs "..." --root /opt/team/skills --root /srv/agents/skills
```

With an empty or unreadable catalog it exits 1 and tells you to run `--doctor` rather
than printing a stack trace. `--doctor` answers *is it seeing my skills?*:

```
catalog: 172 skills (5 model-hidden)
roots:
  ✓ /home/me/.pi/agent/skills  (170 SKILL.md)
  · /home/me/.claude/skills  (missing, skipped)
duplicate names (first root wins): ...
unparsable SKILL.md (no name/description frontmatter): ...
```

## Extending it

Four layers, cheapest fix first:

| Symptom | Fix |
|---|---|
| The user's words mean something the skill never says | add a `CONCEPTS` rule |
| The task shape recurs | add a row to `references/task-types.md` |
| A noisy neighbour outranks a good skill | `DEMOTE`, or a `demote` in a concept |
| A platform skill leaks into generic queries | extend `GATES` |

Private or site-specific rules (your own project names, internal tools) go in
`concepts.local.json` next to the script, which is **gitignored**:

```json
[{ "when": "\\b(my-internal-api|project-bluebird)\\b", "boost": { "platform-docs": 9 } }]
```

Absent file = no-op, so a fresh clone behaves exactly like this repo.

## Learning from its own mistakes

A tuned scorer plateaus. Every real correction ("no, it's the other one") is information
the lexical layer can never recover on its own, so corrections are recorded and reapplied:

```bash
node scripts/find_skills.mjs --learn "the box keeps dying on the shelf" k8s-triage
node scripts/find_skills.mjs --wrong "flatten the acroform" email-sequence
node scripts/find_skills.mjs --memory     # what it has learned so far
node scripts/find_skills.mjs --forget     # clear it
```

- **`--learn`** pins the skill for that phrasing, weighted by how many times it has
  been confirmed, and scaled by token similarity so near-identical wording transfers
  (Jaccard ≥ 0.5). It also lifts the lexical-confidence gate, because the whole point
  of a correction is to survive the layer that got it wrong.
- **`--wrong`** demotes a skill for similar phrasing, so a repeated false positive
  stops coming back.
- Learned hits are marked `learned+N` / `learned✗` under `--explain`, and they cannot
  outrank an unconditional platform gate or hijack an unrelated query (verified).

Storage is one JSONL line per correction at `memory.local.jsonl` (gitignored) or
`$SKILL_ROUTER_MEMORY`. Plain text, portable between machines, capped at the most
recent 1000 corrections, duplicate corrections increment a counter instead of
appending. An entry naming a skill that is not installed is inert, so a shared memory
file is safe on a catalog that has never seen that skill.

Deliberate split: **`CONCEPTS` is for general behaviour** (edited by a human, reviewed
in a diff), **memory is for "this phrasing, this skill"** (written at runtime). If
`--memory` shows the same skill being corrected for the same kind of wording, promote
the pattern into `CONCEPTS` and forget the entries.

## Testing

```bash
node scripts/eval_routing.mjs            # score: 80/80 (100.0%)  gate leaks: 0
node scripts/eval_routing.mjs --verbose  # per-case ranking
node scripts/eval_routing.mjs quest      # only cases whose query contains "quest"
node scripts/smoke_portable.mjs          # foreign catalog + 600-skill scale run
```

`eval_routing.mjs` is the quality suite: each case is a realistic phrasing plus the
set of skills that are genuinely acceptable answers; a case passes when any of them
lands in the top 3. The `FORBID` list asserts that a generic React query never
surfaces a Quest or CloudBase skill. Cases whose expected skills are not installed on
your machine are **skipped**, not failed.

`smoke_portable.mjs` is the portability suite: it writes 16 skills in domains this
router has never seen (Kubernetes triage, Rust borrow checker, Salesforce Apex,
Postgres query plans, Terraform state, Blender rigging…), then asserts ranking,
paraphrase robustness, the portable gate, duplicate-name collapse, empty-catalog
exit codes, paths containing spaces, `SKILL_ROUTER_ROOTS`, the learning loop
(correction applied, transferred, vetoed, forgotten), and a 600-skill run.

Rule followed while building this: add the failing query to `CASES` first, watch it
fail, then fix the layer above. The first measured baseline was 52/70; every point
after that came from a specific recorded failure, not from intuition.

## Caveats

- `references/task-types.md` names skills from the author's install (`dsh-*`, `hz-*`,
  `vercel-*`, `kimi-*` and others). Those come from separate packages with their own
  licences and are **not** included here — the table is an example mapping of task
  shapes to skills, and the names only mean something if you have that package.
- The sketchiest part is `CONCEPTS`: it is hand-written intent, tuned on recorded
  failures. It generalises worse than the IDF layer, which is why it can only add
  points and never outrank a gate.
- Tuning on your own examples is how a router gets good at your examples. Write the
  case down before you change the scorer.

## License

MIT — see [LICENSE](LICENSE).
