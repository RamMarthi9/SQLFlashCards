# Architecture

SQLFlashCards uses a staged implementation. This document records the agreed architecture and identifies which parts exist in Stage 1.

## Stage 1 scope

Stage 1 contains the React app shell, strict TypeScript configuration, Vite build tooling, ESLint, Vitest, a render smoke test, dependency lockfile, and CI checks. The shell introduces the planned product. It does not yet load a flashcard collection, track learning, schedule reminders, or store learner data.

The application is developed and checked locally. Hosting setup, service purchases, Android packaging, and public releases are outside this stage.

## Decisions

| Area | Decision | Stage 1 status |
| --- | --- | --- |
| Interface | React and TypeScript with strict type checking | Scaffolded |
| Development and build | Vite | Configured |
| Source of truth | GitHub for code, content, tests, and documentation | Repository and PR workflow |
| Learning content | General SQL topics in versioned JSON in Git; label database-specific syntax and behaviour in relevant examples | Planned |
| Learner progress | IndexedDB in the browser | Planned |
| Web hosting | Vercel | Planned; no deployment |
| Android distribution | Trusted Web Activity through Bubblewrap | Planned; no Android package |
| Accounts and synchronization | A later cloud phase | Deferred |
| SQL execution | Display examples; do not execute user-supplied SQL in the MVP | Constraint for future features |

## Visual design reference

The user supplied this mockup on November 19, 2026 as the intended visual direction for both the Android app and the web browser experience.

![SQLFlashCards mockup showing a Left Join topic card, four learning sections, revision count, and proficiency levels](app-design-reference.png)

- Use a light lavender background, purple gradients, large rounded cards, soft shadows, bold dark text, and the SQLFlashCards name with a stacked-card logo.
- Place a prominent purple topic card below the header, with the topic name and an explanatory visual. The example shows Left Join with the entire left circle shaded green, including the overlap.
- Arrange four large learning tiles in two columns: Definition in coral, Concept in yellow, Examples in mint green, and Syntax in blue. Pair each label with a simple icon.
- Show a separate Number of revisions row with a revision icon and a prominent purple count badge.
- Show Proficiency below it, with Beginner, Intermediate, and Expert levels and a purple highlight for the current level.
- Preserve this visual hierarchy across Android and web, adapting sizing and spacing to the screen while keeping text readable and controls easy to tap.

Left Join, the count of 3, and the highlighted Intermediate level are illustrative mockup values, not initial learner data. Proficiency should reflect the planned performance-based expertise feature; the scoring formula remains to be defined. The mockup does not define what happens when a learning tile is opened. This reference records the intended design for a later implementation stage; the current app remains the Stage 1 shell.

## Module boundaries

`src/main.tsx` mounts React. `src/app/` contains the app shell and its component test; shared styling lives in `src/styles.css`. Test setup lives in `src/test/`. Keep configuration at the repository root and project design, status, reference, and educational artifacts in `docs/project-artifacts/`.

As later stages introduce behavior, use these boundaries:

| Boundary | Responsibility | Constraints |
| --- | --- | --- |
| UI: `src/app/` | Render learning state and handle user actions | Delegate scheduling and scoring to the domain layer. |
| Domain: future `src/domain/` | Pure rules for progress, revision scheduling, counts, and expertise | No React, browser storage, network calls, or implicit system clock. Pass dates and other inputs explicitly. |
| Storage: future `src/storage/` | IndexedDB access, persistence, and data migrations | Implement interfaces consumed by application services; keep database details out of components and domain rules. |
| Content: future versioned JSON | Reviewed questions, answers, explanations, and SQL examples | Keep content separate from learner records; identify database-specific examples and validate content when its stage is implemented. |

The future domain and storage directories are intentionally not created in Stage 1. Their interfaces should follow the requirements of the stage that introduces them, rather than introducing unused abstractions now.

## Learning requirements for later stages

- Separate covered and uncovered syllabus views, with completion independent of mastery.
- Interactive flashcards with answer reveal and performance feedback.
- Saved local progress in IndexedDB, including topic completion and revision history.
- A visible count of how many times each topic has been revised.
- An expertise level for each topic derived from performance, with an explanation the learner can understand.
- Revision reminders following the requested 1, 3, 5, 7, 20, and 30 day rule.

These are requirements, not implemented functionality. The reminder stage must decide whether those day numbers are offsets from initial learning or intervals between revisions, what happens after a missed reminder, which timezone applies, and how a revision is counted. The expertise stage must define the performance inputs, thresholds, and behavior when there is too little evidence to assign a level.

Closed-app alarms, notification permissions, and delivery guarantees also need an explicit design and verification stage. The scaffold makes no promise that a reminder can fire while the browser or Android app is closed.

## Quality and delivery

Keep TypeScript strict for both application code and tooling. Use automated linting, a render smoke test, and a production build as the initial quality checks; add behavior tests as behavior is introduced. Keep business rules testable independently of the UI and IndexedDB.

Use `npm ci` for reproducible installs from the committed lockfile. Run `npm run check` locally and inspect the GitHub Actions result on the PR. Record failures or unavailable checks honestly; do not replace a failed test with a weaker one or disable checks to obtain a pass.

Use small branches and reviewable PRs. Each stage report must include changed files, check evidence, manual verification instructions, outstanding issues, and a branch/commit or PR link. Update documentation when behavior changes.

Keep secrets, signing keys, and learner records out of Git. No cloud credentials are required for Stage 1. Provisioning Vercel, configuring Bubblewrap, setting up cloud accounts, or publishing a release requires a separately requested stage.
