# SQLFlashCards

SQLFlashCards is a PostgreSQL learning app being built around short flashcards, syllabus coverage, and spaced revision.

**Stage 1: application foundation.** The repository now provides a React, TypeScript, and Vite scaffold with a static app shell, strict type checking, linting, a render smoke test, and a production build. Flashcard interaction, progress storage, reminders, revision counts, and expertise scoring are future work.

## Run locally

Use Node.js 22.13 or newer within Node 22, Node 24, or Node 26 and newer, with npm 10 or newer. The `.nvmrc` selects Node 22. Run these commands from the `SQLFlashCards` repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. In Windows PowerShell, use `npm.cmd` instead of `npm` if script execution policy blocks `npm.ps1`.

`npm ci` installs the versions in `package-lock.json`. Commit changes to both `package.json` and the lockfile when updating dependencies. No environment variables, database, account, or credentials are needed for Stage 1.

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

1. Run `npm ci`, then `npm run check`.
2. Run `npm run dev` and open the printed URL. Confirm the SQLFlashCards shell loads and identifies the learning features as planned.
3. Inspect the browser console for errors. Check the layout at a desktop width and a narrow mobile width, including readable text and no horizontal overflow.
4. Navigate any links with the keyboard and confirm the focus indicator is visible.
5. Stop the dev server, run `npm run build`, then `npm run preview`. Repeat the loading and console checks using the preview URL.

These steps are verification instructions, not a claim that browser checks have already been performed. This stage does not provide functioning flashcards, saved progress, or alarms to test.

## Repository layout

```text
src/
  main.tsx              React entry point
  app/                  App shell, styles, and component test
  styles.css            Shared page styles
  test/setup.ts         Test environment setup
docs/project-artifacts/
  README.md             Artifact index and maintenance workflow
  status.md             Current progress and verification record
  hld.md                High level system design
  lld.md                Low level implementation design
  architecture.md       Architecture decisions and stage boundaries
  syllabus.md           Planned PostgreSQL syllabus and example card
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
- PostgreSQL is the primary teaching dialect. The MVP will display SQL examples without executing user-supplied SQL.
- Vercel will host the web application in a later deployment stage. Android distribution will use a Trusted Web Activity through Bubblewrap in a later stage.

The planned learning flow is topic selection, answer reveal, performance feedback, and revision. It will distinguish covered and uncovered topics, count revisions, and report an expertise level based on performance. Revision reminders must support the requested **1, 3, 5, 7, 20, and 30 day** rule; its scheduling semantics and the expertise formula still need to be specified before implementation.

All design, status, syllabus, and visual reference artifacts live in [Project artifacts](docs/project-artifacts/README.md). See [Project status](docs/project-artifacts/status.md) for progress, the [High level design](docs/project-artifacts/hld.md) for system components and delivery, the [Low level design](docs/project-artifacts/lld.md) for component contracts and interactions, [Architecture](docs/project-artifacts/architecture.md) for technical decisions, and [Planned syllabus](docs/project-artifacts/syllabus.md) for the learning scope.

## Contributing

Implement only the requested stage. Inspect the repository first, work on a small branch, and open a reviewable PR. Include changed files, executed checks, checks that could not run, manual verification steps, and outstanding issues. Keep the dependency lockfile and documentation current; fix failing checks without disabling them or weakening tests.

Update the affected [project artifacts](docs/project-artifacts/README.md) alongside each relevant change, and keep the status record and design documents consistent with the implemented app.

Never commit credentials, `.env` secrets, Android signing keys, or learner data. Git ignore rules are a safeguard, so review the staged diff as well. Stage 1 does not deploy to Vercel, package Android, purchase services, or publish a public release.

Reference documentation: [Vite](https://vite.dev/guide/), [TypeScript strict mode](https://www.typescriptlang.org/tsconfig/strict.html), and [Vitest](https://vitest.dev/guide/).
