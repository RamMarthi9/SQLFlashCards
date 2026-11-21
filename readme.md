# SQLFlashCards

SQLFlashCards is a SQL learning app being built around short flashcards, syllabus coverage, and spaced revision.

**First working flashcard flow.** Choose a topic, read a question, reveal its answer, explore Definition, Concept, Examples, and Syntax, and move between cards. Six starter cards cover SELECT, DISTINCT, WHERE, NULL, INNER JOIN, and LEFT JOIN. All 14 syllabus topics are listed; the other 11 show Content coming soon. Saved progress, reminders, revision counts, and proficiency scoring are future work.

## Run locally

Use Node.js 22.13 or newer within Node 22, Node 24, or Node 26 and newer, with npm 10 or newer. The `.nvmrc` selects Node 22. Run these commands from the `SQLFlashCards` repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In Windows PowerShell, use `npm.cmd` instead of `npm` if script execution policy blocks `npm.ps1`.

`npm ci` installs the versions in `package-lock.json`. Commit changes to both `package.json` and the lockfile when updating dependencies. No environment variables, database, account, or credentials are needed for the current learning flow.

TypeScript 6 and Vitest 4 are pinned to compatible versions of the lint tooling and Testing Library matchers. Upgrade these packages together only after the full checks pass; library declarations are checked too.

## Checks and build

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check the application and tooling with strict TypeScript. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run the test suite once and exit. |
| `npm run test:watch` | Run tests while developing. |
| `npm run build` | Create the production assets in `dist/`. |
| `npm run preview` | Serve the production build locally after building. |
| `npm run check` | Run type checking, linting, tests, and the production build. |

The GitHub Actions workflow installs dependencies with `npm ci` and runs the same checks. A workflow definition alone is not evidence of a passing run; inspect the PR checks for the outcome. Local test evidence and any checks that could not run belong in the stage's PR description.

### Known dependency issue

As of November 18, 2026, the dependency audit reports a high-severity denial-of-service advisory in the development-only `picomatch` dependency, propagated through the build, lint, and test tools. The [upstream advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) lists no patched version. Review dependency updates when a fix becomes available. Keep development servers local and do not feed untrusted glob patterns to tooling. This finding remains open; it is not suppressed or reported as a passing full audit.

## Manual verification

1. In Windows PowerShell, run `npm.cmd ci` if dependencies are not installed, then `npm.cmd run check` for type checking, linting, automated tests, and the production build.
2. Run `npm.cmd run dev` and open the URL Vite prints. Confirm all 14 topics appear, with starter cards in Basic queries, Filtering, and Joins and Content coming soon for the other topics.
3. Open Basic queries. Read the first question and confirm its answer is hidden; select Reveal answer to show it. Select each of Definition, Concept, Examples, and Syntax. Only one panel should be open; select the same tile again to close it.
4. Use Next and Previous. Confirm the card position changes, the answer and section reset, and navigation is disabled at the first/last card. Use browser Back and Forward and confirm they restore the correct card with its answer hidden.
5. Open Joins and the Left Join card. Check its diagram, then compare the input and result tables in Examples. Open a section with the keyboard, activate its Close button, and confirm focus returns to that section's tile.
6. Reload a card URL such as `#/topics/joins/cards/joins-left-basic`. It should reopen that card with the answer hidden. Try `#/topics/joins/cards/missing` and confirm a clear unavailable-content view offers a return to Topics.
7. Check at 320, 390, 768, and 1280 px widths and with enlarged text. Text and controls should remain readable; SQL and table panels may scroll horizontally without causing whole-page overflow. Navigate with Tab and Enter/Space and inspect the browser console for errors.
8. Stop the dev server and run `npm.cmd run preview` after the successful build. Repeat the topic, card, deep-link, and browser-console checks using the preview URL.

These are repeatable test instructions; actual completed checks are recorded in [Project status](docs/project-artifacts/status.md). Answers and open sections reset on navigation or refresh. This version does not save learning progress, execute SQL, count revisions, assign proficiency, or schedule reminders.

## Repository layout

```text
src/
  main.tsx              React entry point
  app/                  Hash routes, topic/learning screens, components, styles, and tests
  content/              Versioned JSON starter cards, content types, validation, and tests
  styles.css            Shared page styles
  test/setup.ts         Test environment setup
docs/project-artifacts/
  README.md             Artifact index and maintenance workflow
  status.md             Current progress and verification record
  hld.md                High level system design
  lld.md                Low level implementation design
  architecture.md       Architecture decisions and stage boundaries
  syllabus.md           Planned SQL syllabus and example card
  sql-syllabus-index.md Indexed SQL topics and source references
  app-design-reference.png  User's Android and web mockup
AGENTS.md               Artifact maintenance guidance for project work
.github/workflows/      Automated checks
package-lock.json       Reproducible dependency installation
```

The strict TypeScript, ESLint, Vite, and Vitest configuration files live at the repository root. Business logic and storage adapters will be added as separate modules when their stages are requested.

## Agreed direction

- React and strict TypeScript provide the interface; Vite handles local development and builds.
- GitHub is the source of truth for code, versioned JSON flashcards, tests, and documentation.
- IndexedDB will store learner progress. Cloud accounts and synchronization are a later phase.
- Teach SQL concepts broadly, with no single database engine as the default teaching dialect. Label database-specific syntax where needed. The MVP will display SQL examples without executing user-supplied SQL.
- Vercel will host the web application in a later deployment stage. Android distribution will use a Trusted Web Activity through Bubblewrap in a later stage.

Topic selection, answer reveal, inline learning sections, and card navigation are implemented. Later stages will add performance feedback, explicit covered/uncovered topics, revision counts, and proficiency based on performance. Revision reminders must support the requested **1, 3, 5, 7, 20, and 30 day** rule; its scheduling semantics and the proficiency formula still need to be specified before implementation.

All design, status, syllabus, and visual reference artifacts live in [Project artifacts](docs/project-artifacts/README.md). See [Project status](docs/project-artifacts/status.md) for progress, the [High level design](docs/project-artifacts/hld.md) for system components and delivery, the [Low level design](docs/project-artifacts/lld.md) for component contracts and interactions, [Architecture](docs/project-artifacts/architecture.md) for technical decisions, and [Planned syllabus](docs/project-artifacts/syllabus.md) for the learning scope.

The separate [SQL syllabus index](docs/project-artifacts/sql-syllabus-index.md) contains numbered subtopics, learning outcomes, prerequisites, and source references.

## Contributing

Implement only the requested stage. Inspect the repository first, work on a small branch, and open a reviewable PR. Include changed files, executed checks, checks that could not run, manual verification steps, and outstanding issues. Keep the dependency lockfile and documentation current; fix failing checks without disabling them or weakening tests.

Update the affected [project artifacts](docs/project-artifacts/README.md) alongside each relevant change, and keep the status record and design documents consistent with the implemented app.

Never commit credentials, `.env` secrets, Android signing keys, or learner data. Git ignore rules are a safeguard, so review the staged diff as well. The current stage does not deploy to Vercel, package Android, purchase services, or publish a public release.

Reference documentation: [Vite](https://vite.dev/guide/), [TypeScript strict mode](https://www.typescriptlang.org/tsconfig/strict.html), and [Vitest](https://vitest.dev/guide/).
