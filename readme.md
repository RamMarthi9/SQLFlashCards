# SQLFlashCards

SQLFlashCards is a SQL learning app being built around short flashcards, syllabus coverage, and spaced revision.

**First working flashcard flow.** Choose a topic, read a question, reveal its answer, explore Definition, Concept, Examples, and Syntax, and move between cards. Six starter cards cover SELECT, DISTINCT, WHERE, NULL, INNER JOIN, and LEFT JOIN. All 14 syllabus topics are listed; the other 11 show Content coming soon. Sign up with a unique name and four-digit PIN, then save completed/incomplete topics separately in your account. Signing in to the same server from another browser restores your progress. Reminders, revision counts, and proficiency scoring are future work.

## Run locally

Use Node.js 22.13 or newer within Node 22, Node 24, or Node 26 and newer, with npm 10 or newer. The `.nvmrc` selects Node 22. Run these commands from the `SQLFlashCards` repository root:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`, or the local URL printed by the launcher. The command starts the account API and Vite together. In Windows PowerShell, use `npm.cmd` instead of `npm` if script execution policy blocks `npm.ps1`. Restart this command after editing server code; client changes use Vite's normal refresh behavior.

`npm ci` installs the versions in `package-lock.json`. Commit both files when updating dependencies. Local development needs no separate database installation or hosting account: the Node server creates `user-data/accounts.sqlite` and a private development PIN pepper in `user-data/pin-pepper`. Keep this ignored directory between runs. Do not commit it, and do not delete or replace its pepper while retaining accounts that depend on it.

Sign up using only Name and a four-digit PIN. Names must be unique without case distinctions. PINs can begin with zero and are never stored in the browser. No email is required, so forgotten-PIN recovery is not available in this stage. The four-digit PIN is a limited credential intended for this learning app; the server adds hashing and attempt limits.

TypeScript 6 and Vitest 4 are pinned to compatible versions of the lint tooling and Testing Library matchers. Upgrade these packages together only after the full checks pass; library declarations are checked too.

## Checks and build

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the client, server, and tooling with strict TypeScript. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the test suite once and exit. |
| `npm run test:watch` | Run tests while developing. |
| `npm run build` | Build the client assets and compiled Node server. |
| `npm run preview` | Serve the built website and API locally after building, normally on port 4173. |
| `npm start` | Start the production server with an HTTPS origin, private pepper, and durable data directory configured. |
| `npm run check` | Run type checking, linting, tests, and the production build. |

The GitHub Actions workflow installs dependencies with `npm ci` and runs the same checks. A workflow definition alone is not evidence of a passing run; inspect the PR checks for the outcome. Local test evidence and any checks that could not run belong in the stage's PR description.

### Dependency audit

The November 18, 2026 audit reported a development-only `picomatch` denial-of-service advisory. On November 22, 2026, the npm install audit reported **0 vulnerabilities across 252 packages** after adding the development-only `fake-indexeddb` test dependency. This records the current audit result, not a guarantee against future advisories; keep the dependency lockfile and audit evidence current.

## Manual verification

1. In Windows PowerShell, run `npm.cmd ci` if dependencies are not installed, then `npm.cmd run check` for type checking, linting, automated tests, and the production build.
2. Run `npm.cmd run dev` and open the printed frontend URL. Create a test account using a unique Name and four-digit PIN, including a leading zero if desired. Confirm all 14 topics appear, with starter cards in Basic queries, Filtering, and Joins and Content coming soon for the others.
3. Open Basic queries. Read the first question and confirm its answer is hidden; select Reveal answer to show it. Select each of Definition, Concept, Examples, and Syntax. Only one panel should be open; select the same tile again to close it.
4. Use Next and Previous. Confirm the card position changes, the answer and section reset, and navigation is disabled at the first/last card. Use browser Back and Forward and confirm they restore the correct card with its answer hidden.
5. Open Joins and the Left Join card. Check its diagram, then compare the input and result tables in Examples. Open a section with the keyboard, activate its Close button, and confirm focus returns to that section's tile.
6. Reload a card URL such as `#/topics/joins/cards/joins-left-basic`. It should reopen that card with the answer hidden. Try `#/topics/joins/cards/missing` and confirm a clear unavailable-content view offers a return to Topics.
7. Check at 320, 390, 768, and 1280 px widths and with enlarged text. Text and controls should remain readable; SQL and table panels may scroll horizontally without causing whole-page overflow. Navigate with Tab and Enter/Space and inspect the browser console for errors.
8. On Topics, mark Basic queries completed. Wait for the saved result, then confirm its completed status and the completed/total summary. Switch between All, Completed, and Incomplete; the same topic should move between the matching views without losing access to its cards. Topics without cards cannot be newly marked completed.
9. Refresh, then close and reopen the browser. Basic queries should remain completed. Sign out and sign in again; the account should still show it completed. Use a separate browser profile to sign in to the **same website/server** and confirm the same result. Mark the topic incomplete there, refresh the first profile, and confirm that change is saved too.
10. Sign out and create a second test account with a different name. It must start with its own incomplete topics and never show the first account's choices. Sign back into the first account and confirm its records are unchanged. In an isolated test profile, clearing site data should require sign-in again but should not remove the account's server progress.
11. If this browser has progress from the earlier version, sign into the intended account and use the explicit import control only for your own records. Confirm that existing account choices are preserved and the source browser records are retained. A second sign-in must not automatically claim the browser's old progress.
12. Open the same account in two tabs. Change a topic in one and return to the other; it should refresh on focus. A stale save must show the newer state and require explicit retry. Sign out in one tab, then return to the other; it must not keep saving under a stale account. Invalid PINs, unavailable service, and expired sessions should produce clear errors without reporting a save succeeded.
13. Stop and restart the server without removing `user-data/`, then sign in again and confirm progress remains. After a successful build, run `npm.cmd run preview` and repeat the account, card, and progress checks. The configured server data directory determines which account records are available. Cookies are not scoped by port, so development and preview on `127.0.0.1` may reuse the same session cookie; sign in if prompted. A different hostname or profile has a separate cookie context.

These are repeatable test instructions; actual completed checks are recorded in [Project status](docs/project-artifacts/status.md). Answers and open sections reset on navigation or refresh; explicit topic completion is saved separately. Completion records what you chose to mark done, not an assessment of mastery or a claim that the whole topic has authored cards. This version does not execute SQL, count revisions, assign proficiency, or schedule reminders.

Account progress belongs to the server database, not a browser profile. Clearing browser data or using a private profile removes/limits the session cookie; signing in again retrieves server progress. The server must remain available, and its data directory must be preserved and backed up. No offline-launch or offline-write queue is implemented.

## Production hosting

The online deployment uses **Vercel for the website and Node API**, with **Neon PostgreSQL for private accounts and progress**. GitHub holds code and SQL lessons; it does not hold live learner records. Local development continues to use SQLite. Online accounts start fresh, as requested.

Follow the [Vercel deployment and backup runbook](docs/project-artifacts/deployment.md) to connect free accounts, create a PostgreSQL 17 database, configure Vercel Node 24 and production-only `DATABASE_URL`, `APP_ORIGIN`, `SQLFLASHCARDS_PIN_PEPPER`, and `NODEJS_HELPERS=0`, then deploy reviewed source. Preview APIs are disabled. The repository includes the function entry and hosting configuration; [Project status](docs/project-artifacts/status.md) records whether deployment has actually succeeded.

Daily backups export the database directly into authenticated encryption and retain artifacts for 30 days in the separate private [SQLFlashCards-backups repository](https://github.com/RamMarthi9/SQLFlashCards-backups). Configure `BACKUP_DATABASE_URL` and a separate `BACKUP_ENCRYPTION_KEY` there, run the documented backup/restore drill, and enable its reviewed scheduled workflow. The public source repository provides reusable backup code only; configuration alone is not evidence of a successful backup. Keep the PIN pepper and encryption key recoverable separately.

For alternative standalone SQLite hosting, the server needs a Node host with persistent storage. A static-only deployment is insufficient for accounts and progress. Build with `npm run build`, then configure `APP_ORIGIN` to the exact HTTPS website origin, `SQLFLASHCARDS_PIN_PEPPER` to a private secret of at least 32 characters, and `DATA_DIR` to a durable directory before using `npm start`. Set `HOST` and `PORT` for the deployment network. Keep the same pepper when reusing the database and establish consistent backups and a tested restore procedure. Local `npm run preview` is a test server, not a production deployment.

The [account design](docs/project-artifacts/account-progress.md#running-and-operating-the-service) describes settings, sessions, PIN protection, data ownership, and operating limits. Account recovery remains unimplemented. Hosting, backup activation, and actual verification are tracked in the deployment runbook and project status.

## Repository layout

```text
src/
  main.tsx              React entry point
  app/                  Account/session UI, screens, routes, progress coordinator, styles, tests
  domain/               Topic progress records and repository contracts
  storage/              Account HTTP repository and legacy IndexedDB import adapter
  content/              Versioned JSON starter cards, content types, validation, and tests
  styles.css            Shared page styles
  test/setup.ts         Test environment setup
server/                 Shared account API, local SQLite and hosted PostgreSQL stores, tests
api/                    Vercel function entry
scripts/                Development launcher, encrypted backups, and guarded restore tools
docs/project-artifacts/
  README.md             Artifact index and maintenance workflow
  status.md             Current progress and verification record
  hld.md                High level system design
  lld.md                Low level implementation design
  architecture.md       Architecture decisions and stage boundaries
  account-progress.md   Account API, ownership, authentication, import, and operating design
  deployment.md         Vercel/Neon settings, backup/restore runbook, and release checks
  syllabus.md           Planned SQL syllabus and example card
  sql-syllabus-index.md Indexed SQL topics and source references
  app-design-reference.png  User's Android and web mockup
AGENTS.md               Artifact maintenance guidance for project work
.github/workflows/      Automated checks and reusable private-backup workflow
vercel.json             Website, API packaging, and security header configuration
package-lock.json       Reproducible dependency installation
```

The strict TypeScript, ESLint, Vite, and Vitest configuration files live at the repository root. The client calls a repository interface; server transactions and account authorization stay outside UI components.

## Agreed direction

- React and strict TypeScript provide the interface; Vite handles local development and builds.
- GitHub is the source of truth for code, versioned JSON flashcards, tests, and documentation.
- A Node API stores explicit completion per account in Neon PostgreSQL online and SQLite locally. The previous IndexedDB records are an optional, explicit import source only.
- Teach SQL concepts broadly, with no single database engine as the default teaching dialect. Label database-specific syntax where needed. The MVP will display SQL examples without executing user-supplied SQL.
- Vercel provides HTTPS and executes the API; Neon retains account data across deployments. Daily encrypted backups supplement the free database recovery window. Android distribution remains a planned Trusted Web Activity through Bubblewrap.

Topic selection, answer reveal, inline learning sections, card navigation, and saved completed/incomplete topics are implemented. Later stages will add performance feedback, revision counts, and proficiency based on performance. Revision reminders must support the requested **1, 3, 5, 7, 20, and 30 day** rule; its scheduling semantics and the proficiency formula still need to be specified before implementation.

All design, status, syllabus, and visual reference artifacts live in [Project artifacts](docs/project-artifacts/README.md). See [Project status](docs/project-artifacts/status.md) for progress, the [High level design](docs/project-artifacts/hld.md) for system components and delivery, the [Low level design](docs/project-artifacts/lld.md) for component contracts and interactions, [Architecture](docs/project-artifacts/architecture.md) for technical decisions, and [Planned syllabus](docs/project-artifacts/syllabus.md) for the learning scope.

The separate [SQL syllabus index](docs/project-artifacts/sql-syllabus-index.md) contains numbered subtopics, learning outcomes, prerequisites, and source references.

## Contributing

Implement only the requested stage. Inspect the repository first, work on a small branch, and open a reviewable PR. Include changed files, executed checks, checks that could not run, manual verification steps, and outstanding issues. Keep the dependency lockfile and documentation current; fix failing checks without disabling them or weakening tests.

Update the affected [project artifacts](docs/project-artifacts/README.md) alongside each relevant change, and keep the status record and design documents consistent with the implemented app.

Never commit credentials, `.env` secrets, Android signing keys, learner data, or decrypted backups. Git ignore rules are a safeguard, so review the staged diff as well. Vercel hosting is authorized on free plans only; service purchases and Android packaging are outside this change.

Reference documentation: [Vite](https://vite.dev/guide/), [TypeScript strict mode](https://www.typescriptlang.org/tsconfig/strict.html), and [Vitest](https://vitest.dev/guide/).
