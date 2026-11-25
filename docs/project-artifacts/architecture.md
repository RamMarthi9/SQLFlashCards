# Architecture

SQLFlashCards uses a staged implementation. This document records the agreed architecture and distinguishes the working learning flow and saved topic completion from future review and delivery features.

## Current implementation scope

The Stage 1 foundation provides React, strict TypeScript, Vite, ESLint, Vitest, a dependency lockfile, and CI checks. The learning flow loads validated versioned JSON with all 14 syllabus topics and six starter cards across Basic queries, Filtering, and Joins. Learners can choose a topic, reveal answers, toggle four learning sections, and navigate between cards. Empty topics display Content coming soon. The account stage adds name-and-four-digit-PIN sign-up/sign-in and stores explicit Completed/Incomplete choices separately for each account on the server. The list filters and completion summary retain their existing semantics. Review history, reminders, and proficiency remain future stages.

The November 25 hosting decision is Vercel for the website and Node API, with Neon PostgreSQL for private account data. The user selected free plans only and a fresh online account database; local test accounts remain untouched. Deployment and backup configuration are part of this stage, while provider access, live checks, and release state are tracked separately in [Project status](status.md). Android packaging remains future work.

## Decisions

| Area | Decision | Current status |
| --- | --- | --- |
| Interface | React and TypeScript with strict type checking | Topic and learning screens implemented |
| Development and build | Vite | Configured |
| Source of truth | Public GitHub repository for code, content, tests, and documentation | Repository and PR workflow; account records remain private in Neon |
| Learning content | General SQL topics in versioned JSON in Git; label database-specific syntax and behaviour in relevant examples | Runtime-validated catalogue with six starter cards and curriculum mappings |
| Learner progress | Account-scoped records through a shared server repository contract: Neon PostgreSQL online, SQLite for local development | Explicit topic completion; legacy IndexedDB is an optional import source only |
| Identity | Unique name plus four-digit PIN; server sessions in HttpOnly cookies | Sign-up/sign-in/sign-out and account ownership checks; no email or PIN recovery flow |
| Web hosting | Vercel serves Vite assets and same-origin Node API functions; Neon holds durable account data | Free-plan deployment configuration; see status for provisioning and live verification |
| Backups | Neon restore history plus daily encrypted PostgreSQL exports to a separate private GitHub repository's Actions artifacts, retained 30 days | SHA-pinned private caller invokes the public reusable workflow; secrets and enablement remain private, and successful live backup/restore must be recorded separately |
| Android distribution | Trusted Web Activity through Bubblewrap | Planned; no Android package |
| Cross-browser progress | Sign in to the same account on the same running server | Server-owned records; no offline write queue or real-time push |
| SQL execution | Display examples; do not execute user-supplied SQL in the MVP | Examples and result tables displayed; no execution environment |

## Visual design reference

The user supplied this mockup on November 19, 2026 as the intended visual direction for both the Android app and the web browser experience.

![SQLFlashCards mockup showing a Left Join topic card, four learning sections, revision count, and proficiency levels](app-design-reference.png)

- Use a light lavender background, purple gradients, large rounded cards, soft shadows, bold dark text, and the SQLFlashCards name with a stacked-card logo.
- Place a prominent purple topic card below the header, with the topic name and an explanatory visual. The example shows Left Join with the entire left circle shaded green, including the overlap.
- Arrange four large learning tiles in two columns: Definition in coral, Concept in yellow, Examples in mint green, and Syntax in blue. Pair each label with a simple icon.
- Show a separate Number of revisions row with a revision icon and a prominent purple count badge.
- Show Proficiency below it, with Beginner, Intermediate, and Expert levels and a purple highlight for the current level.
- Preserve this visual hierarchy across Android and web, adapting sizing and spacing to the screen while keeping text readable and controls easy to tap.

Left Join is implemented as a starter card, while the count of 3 and the highlighted Intermediate level remain illustrative mockup values. The current screen uses the reference's colour palette, hero, section tiles, and join diagram, adding question/reveal and bounded previous/next navigation. Tiles toggle one inline panel; Close returns focus to the originating tile. Revision and proficiency widgets remain hidden until the relevant persistence and scoring policies are implemented. The original reference image is preserved.

## Module boundaries

`src/main.tsx` mounts React. `src/app/` contains account/session handling, the screen host, routes, topic and learning screens, content rendering, styling, and interaction tests. `src/content/` owns the JSON catalogue and its validation. `src/app/useTopicProgress.ts` coordinates completion; `src/domain/progress.ts` defines its contracts. `src/storage/httpProgress.ts` is the authoritative account repository; `src/storage/indexedDbProgress.ts` reads the previous browser-only store for explicit import. `server/` owns authentication, request validation, and the SQLite/PostgreSQL stores; `api/` adapts the handler to Vercel. The standalone server also serves built assets for local preview. Backup tooling belongs in `scripts/` and its workflow in `.github/workflows/`. Shared styling lives in `src/styles.css`; test setup lives in `src/test/`. Keep design and status artifacts in `docs/project-artifacts/`.

The current progress feature and later stages use these boundaries:

| Boundary | Responsibility | Constraints |
| --- | --- | --- |
| UI: `src/app/` | Render learning state and handle user actions | Delegate scheduling and scoring to the domain layer. |
| Domain: `src/domain/` | Progress and repository contracts; later pure revision scheduling, counts, and expertise | No React, browser storage, network calls, or implicit system clock. Pass dates and other inputs explicitly. |
| Client repository: `src/storage/` | Account-bound HTTP progress requests and legacy IndexedDB import access | Never authorize an account from a client-supplied ID; never silently fall back to browser saves. |
| Server: `server/`, `api/` | Sessions, PIN verification, attempt limits, account authorization, and database transactions | Derive ownership from the session; validate every write; keep raw PINs, cookie tokens, and secrets out of logs and Git. |
| Content: `src/content/` | Versioned JSON questions, answers, explanations, tables, SQL examples, and syllabus IDs | Validate before rendering; reject invalid catalogues rather than silently dropping cards. Keep content separate from future learner records and identify database-specific examples. |

The server stores topic progress by `(account_id, topic_id)` and checks the expected version inside the write transaction. It uses the authenticated session's account ID and rejects a mismatched expected-account header, preventing an old tab or late request from writing into a newly signed-in account. Save acknowledgement follows commit. Focus/visibility refresh keeps displayed state current but does not replace authorization or concurrency checks. Review tables are deferred until needed. See [Account and progress design](account-progress.md) for API, storage, security, and operating details.

The prior IndexedDB database `sqlflashcards`, version 1, remains available only for explicit import. Import copies the learner's selected browser history without overwriting records already in the account and preserves the source data. It never assigns a shared browser's records to whoever signs in automatically. Online accounts start fresh by the user's choice; the local SQLite account database is not uploaded or imported.

Hash routes validate both card and topic identity; direct links, refresh, and browser history load the requested content without retaining transient answers or open sections. Explicit topic completion is independent of that state. All active topics count; missing records mean incomplete, retired records remain stored but excluded, and topics without cards cannot be newly completed. Clearing browser data signs the learner out but does not erase server records. The server must be available for account progress; this is not an offline-launch mechanism.

## Learning requirements for later stages

- Performance feedback and durable review history extending the implemented answer-reveal flow.
- Durable account-scoped revision history extending the implemented topic-completion store.
- A visible count of how many times each topic has been revised.
- An expertise level for each topic derived from performance, with an explanation the learner can understand.
- Revision reminders following the requested 1, 3, 5, 7, 20, and 30 day rule.

These are requirements, not implemented functionality. The reminder stage must decide whether those day numbers are offsets from initial learning or intervals between revisions, what happens after a missed reminder, which timezone applies, and how a revision is counted. The expertise stage must define the performance inputs, thresholds, and behavior when there is too little evidence to assign a level.

Closed-app alarms, notification permissions, and delivery guarantees also need an explicit design and verification stage. The scaffold makes no promise that a reminder can fire while the browser or Android app is closed.

## Quality and delivery

Keep TypeScript strict for application, server, and tooling code. Use linting, content tests, interaction tests, real HTTP/database integration tests, and client/server production builds. Test account isolation, restart durability, leading-zero PINs, session expiry/revocation, origin checks, throttling, and version conflicts. Keep future business rules independent of UI and persistence. Actual outcomes belong in [Project status](status.md); browser steps are in the [repository README](../../readme.md#manual-verification).

Use `npm ci` for reproducible installs from the committed lockfile. Run `npm run check` locally and inspect the GitHub Actions result on the PR. Record failures or unavailable checks honestly; do not replace a failed test with a weaker one or disable checks to obtain a pass.

Use small branches and reviewable PRs. Each stage report must include changed files, check evidence, manual verification instructions, outstanding issues, and a branch/commit or PR link. Update documentation when behavior changes.

Keep secrets, signing keys, account databases, and learner records out of Git. The public source repository stores lesson content, tests, and documents. A separate private `SQLFlashCards-backups` repository holds backup secrets and retains only encrypted archives as expiring Actions artifacts, never Git commits. Its scheduled caller pins reviewed public workflow code to a full commit SHA. Local development keeps its database and private PIN pepper in ignored `user-data/`. Vercel uses a private database connection and stable PIN pepper; no account writes depend on function-local files. Neon PostgreSQL and local SQLite are infrastructure choices, not teaching dialects. A four-digit PIN is a deliberately limited credential, protected by slow hashing, a server-side pepper, and attempt limits; it is not suitable for sensitive records. See the [deployment runbook](deployment.md) for free-plan limits, secret handling, backup activation, restoration, and release checks. Stronger authentication/recovery and Android packaging remain future work.
