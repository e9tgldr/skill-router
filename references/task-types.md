# Task types → skill chain

Fast path for routine requests. Find the row, use the chain in order, skip the search.
**No row fits → run `scripts/find_skills.mjs` instead.** A chain of "—" means no skill
fits and the work should be done directly.

Notation: `a → b` means load a first, then b. `(either)` means pick one, not both.

| Task shape | Chain | Why / note |
|---|---|---|
| Build a new page, app or component | `frontend-patterns` → `ui-craft` or `design-taste-frontend` | Structure, then taste. Add `modern-web-guidance` when the work is HTML/CSS/JS APIs |
| Existing UI looks generic / templated | `design-taste-frontend` or `ui-craft` | Audit-first; do not rebuild what exists |
| Redesign / restyle an existing screen | `impeccable` → `polish` | `impeccable` covers the reshape, `polish` the final pass |
| UI review, accessibility audit, "what's wrong with this" | `web-design-guidelines` or `critique` | Read-only findings, no edits unless asked |
| Typography feels off | `typeset` | Font, scale, tracking, leading |
| No colour identity / too many colours | `colorize` | One accent, 3–5 placements |
| Add motion, transitions, "make it feel alive" | `animate` | Use `animate-expo` for React Native, never both |
| Animation audit across a codebase | `improve-animations` | Plans fixes, does not apply them |
| Native-feeling behaviour on phones | `mobile-native` | Viewport, tap, hover, safe-area fixes |
| View transitions / shared-element page transitions | `vercel-react-view-transitions` | React ViewTransition API |
| Fancy animated React components / hero sections | `react-bits` | 212 prebuilt components |
| Component API smells (boolean prop proliferation) | `vercel-composition-patterns` | Compound components, slots |
| React performance / re-render / hooks problem | `frontend-patterns` → `react-best-practices` | Review pass after the fix |
| Debug anything broken | `systematic-debugging` | Process first, then domain skill |
| Write tests / TDD | `test-driven-development` | Add `e2e-testing` for Playwright suites |
| Flaky or failing browser tests | `e2e-testing` or `playwright-cli` | `playwright-cli` drives a browser directly |
| Verify a web app actually works end to end | `webapp-testing` or `verification` | Needs the dev server running |
| Backend endpoint / API design | `api-design` → `backend-patterns` | Contract before implementation |
| Choosing hosting/storage/queue for a backend | `create-a-backend` | Vercel-flavoured options |
| Auth, secrets, payments, user input | `security-review` | Do this before shipping, not after |
| Next.js app work (routing, RSC, caching) | `nextjs` | Add `next-cache-components` for PPR/cache work |
| shadcn/ui setup and composition | `shadcn` | + `theme-factory` for theming |
| Deploy, rollback, CI for Vercel | `deployments-cicd` → `vercel-cli` | |
| Environment variables / secrets plumbing | `env-vars` | |
| Feature flags / A/B rollout | `flags-sdk` | |
| Durable background work, long tasks | `workflow` or `queues` | `workflow` for orchestration, `queues` for buffering |
| Build an AI agent / chat app | `build-agents` → `ai-sdk` (or `eve`) | `eve` when the framework is explicitly wanted |
| Chat bot across Slack/Discord/Telegram | `chat-sdk` | |
| Model/provider selection, gateway, spend | `ai-gateway` | |
| Chrome extension | `chrome-extensions` | Manifest V3 rules |
| Word document in or out | `docx` | |
| PDF: read, merge, split, fill, OCR | `pdf` | |
| Slides / deck file | `pptx` | + `investor-materials` when it's a fundraise deck |
| Spreadsheet / CSV: build, clean, formula, chart | `xlsx` | Use `xlsx-dsh` only for its deeper analysis features |
| Data-heavy dashboard / admin panel | `ui-craft-dense-dashboard` | Density 9, mono numbers |
| Long-form article, blog, newsletter | `article-writing` (+ `brand-voice`) | `brand-voice` first if a style must be matched |
| Social posts, threads, one asset across platforms | `content-engine` | |
| Pitch deck, one-pager, investor memo, financial model | `investor-materials` | Keep figures consistent across assets |
| HTML presentation from scratch | `frontend-slides` | Add `theme-factory` for styling |
| Diagram, flowchart, architecture, ERD, org chart | `diagram-design` | HTML/SVG/PNG + drawio |
| Poster, static art, generative visuals | `canvas-design` or `algorithmic-art` | `algorithmic-art` = p5.js/seeded |
| Figma file → code / tokens / slides | `figma-bridge` | Needs the Figma URL |
| Complex multi-component web artifact | `web-artifacts-builder` | React + Tailwind + shadcn bundle |
| Screenshot or interact with a real site | `kimi-webbridge` | Uses the user's logged-in browser |
| Operate a Windows desktop app | `kimi-cu` | Real GUI control |
| Record a demo GIF of a web UI | search `gif demo record` | Lives under `dsh-docs` |
| Meta Quest / Horizon OS VR app | `hz-quest-verify-first` → the matching `hz-*` / `metavr-cli` | `hz-quest-verify-first` is mandatory and goes first |
| Android app on Quest (2D port) | `hz-android-2d-porting` or `hz-spatial-sdk` | |
| Quest performance / frame drops / thermal | `hz-perfetto-debug` or `hz-simpleperf-debug` | Trace-based, needs a device trace |
| Vague idea, "let's build X", no spec yet | `brainstorming` → `writing-plans` | Then `executing-plans` or `subagent-driven-development` |
| Multi-step implementation plan to execute | `writing-plans` → `executing-plans` | Parallel-independent tasks → `subagent-driven-development` |
| Big task with independent parts | `dispatching-parallel-agents` | Also read `pi-subagents` for the tool contract |
| Isolated feature branch before risky work | `using-git-worktrees` | |
| Review a PR / diff | `requesting-code-review` (as author) or `receiving-code-review` (as recipient) | |
| Pre-merge / "is this actually done" check | `verification-before-completion` or `verification-loop` | |
| Create or fix a skill | `skill-creator` → `writing-skills` | |
| Look up a library/framework API | `documentation-lookup` | Context7, beats training data |
| High-stakes decision, "should I" | `council` or `council-mode` | `council-mode` when advisors should be mediated |
| Anything about this user's projects, college plan, past decisions | `memory-mnemon` | Background context, not a work skill |
| Set up/repair a Vercel-linked repo | `bootstrap` | Link → env → db ordering |
| Protected Vercel preview returning 401/403 | `access-protected-vercel-deployment` | |

## Second table — narrower tools people forget exist

These are real skills with no obvious name to search for. Check here before
concluding nothing fits.

| Task shape | Chain | Why / note |
|---|---|---|
| "What's this effect called?" (no build) | `animation-vocabulary` | Reverse glossary; pairs with `animate` only when you then build it |
| "Make it feel like Apple" / fluid, physical, interruptible | `apple-design` | Springs, momentum, materials, optical typography |
| Emil Kowalski-style polish judgement | `emil-design-eng` | Opinionated micro-detail review, not a build skill |
| A whole surface in one shot from an outcome | `craft` | Build order + acceptance bar; `sddesign` if you also want a spec file |
| Spec-first pipeline (brief → tokens → spec → build) | `sddesign` | Writes `.ui-craft/spec.md` before code |
| Modal, tooltip, date picker, combobox, toast, `:has()` | `modern-web-guidance` → `shadcn` | Platform primitives first, then the component library |
| Broken or persisting Sonner toasts | `ask-sonner` | Toasts that don't appear, duplicate, or lose styles |
| Swift / iOS code, Swift 6 concurrency | `write-swift` | Data-race errors, actors, ARC |
| Cache hit rate, stale CDN content, ISR/PPR reasons | `cdn-caching` | Read a `vercel` deployment's cache behaviour |
| Per-region KV cache with tag invalidation | `runtime-cache` | Runtime Cache API, not the CDN |
| Business/app metrics instrumentation | `custom-metrics` | `metric()` + `vc metrics` |
| Multi-zone routing, split app across teams | `microfrontends` | `microfrontends.json` local proxy |
| Rewrites, redirects, personalization before cache | `routing-middleware` | Routing Middleware |
| Polyglot app, several services one deployment | `vercel-services` | `services` key, service-targeted rewrites |
| Commerce, payments, email, observability provider | `marketplace` | Discover/install via `vercel integration` |
| Scaffolding a Turborepo SaaS starter | `next-forge` | `npx next-forge init` |
| OAuth/API credentials for third-party APIs | `vercel-connect` | Scoped credentials without storing keys |
| WAF rules, rate limits, DDoS, bot management | `vercel-firewall` | `vercel firewall` CLI |
| Integrate a finished branch (merge vs PR vs keep) | `finishing-a-development-branch` | Comes after verification |
| "Why did this session go badly / cost so much" | `diagnosing-superpowers` | Post-mortem on a superpowers run |
| Stacked PRs, pre-push checks, find simplifications | `dsh-merging-stacked-prs`, `dsh-pre-push-checks`, `dsh-find-simplifications` | DSH repo conventions |
| Prose standard, doc structure, bilingual sync, CoT leaks | `dsh-prose-standard` → `dsh-doc-standards` → `dsh-doc-site-sync` | `dsh-docs` routes between them |
| Kimi Code config inspection/editing | `kimi-platform` | Config + goal contracts |

## Chains worth remembering

- **"Make it not look AI-generated"** — the hardest one to pick well. Default to
  `design-taste-frontend` when the artifact is a *new* landing page or portfolio,
  `ui-craft` when the work is component-level implementation inside an app, `impeccable`
  when an existing interface needs reshaping. Never all three.
- **"Build me X" with no further detail** — `brainstorming` is the correct route even
  though it feels slower. It surfaces the deliverable format the question round would
  have asked about, in the user's own words.
- **Debugging with a stack trace** — `systematic-debugging` first, always. The instinct
  to jump to `frontend-patterns` or `backend-patterns` skips reproduce-then-fix and
  produces speculative patches.
